import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import sharp from 'sharp';

// file-type@22 is ESM-only. The api package uses moduleResolution=Node, which
// cannot statically resolve packages that publish via the `exports` field only.
// Dynamic import + explicit types is the cheapest local workaround; switching
// the whole monorepo to moduleResolution=Bundler is out of scope for this story.
type SniffedFile = { mime: string; ext: string } | undefined;
const fileTypeModuleName = 'file-type';
async function sniffMime(buf: Buffer): Promise<SniffedFile> {
  const mod = (await import(fileTypeModuleName)) as {
    fileTypeFromBuffer: (b: Buffer) => Promise<SniffedFile>;
  };
  return mod.fileTypeFromBuffer(buf);
}
import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { withTenantTx } from '@goldsmith/db';
import { tenantContext } from '@goldsmith/tenant-context';
import { AuditAction, auditLog } from '@goldsmith/audit';
import {
  STORAGE_PORT,
  MALWARE_SCAN_PORT,
  type StoragePort,
  type MalwareScanPort,
} from '@goldsmith/integrations-storage';
import { ProductImagesRepository, type ImageRow } from './product-images.repository';

const MAX_BYTES        = 5 * 1024 * 1024;          // 5 MB
const PROBE_WIDTH      = 1920;
const PROBE_QUALITY    = 80;
const PROBE_EFFORT     = 6;
const VARIANT_BYTE_CAP = 250_000;                   // 250 KB
const MIN_DIM          = 200;
const MAX_DIM          = 8000;
const MAX_IMAGES_PER_PRODUCT = 10;
const MAX_ALT_TEXT_LENGTH    = 200;

const ALLOW_LIST = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

export type UploadInput = {
  productId: string;
  file: { buffer: Buffer; mimeType: string; size: number };
  altText?: string | null;
  idempotencyKey?: string | null;
};

@Injectable()
export class ProductImagesService {
  constructor(
    private readonly repo: ProductImagesRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject(MALWARE_SCAN_PORT) private readonly malwareScan: MalwareScanPort,
    @Inject('PG_POOL') private readonly pool: Pool,
  ) {}

  async upload(input: UploadInput): Promise<ImageRow> {
    const { productId, file, altText, idempotencyKey } = input;
    const ctx = tenantContext.requireCurrent();
    if (!ctx.authenticated) {
      throw new ForbiddenException({ code: 'UNAUTHENTICATED' });
    }
    const { shopId, userId } = ctx;

    // F3 (Codex P2): alt_text length is enforced on upload, mirroring setAltText
    // so the upload path never produces a row that would later be rejected.
    if (altText !== null && altText !== undefined && altText.length > MAX_ALT_TEXT_LENGTH) {
      throw new BadRequestException({ code: 'ALT_TEXT_TOO_LONG' });
    }

    // 1. Body-size cap (before any sharp work — defense against libvips CVEs)
    if (file.size > MAX_BYTES) {
      throw new PayloadTooLargeException({ code: 'PAYLOAD_TOO_LARGE' });
    }

    // F7 (Codex P2) early replay: cheap SELECT before storage upload + sharp.
    // The in-tx race-loser net (UNIQUE 23505 catch) is the safety backstop for
    // two concurrent retries that both pass this check.
    if (idempotencyKey) {
      const existing = await withTenantTx(this.pool, (tx) =>
        this.repo.findByIdempotencyKeyInTx(tx, productId, idempotencyKey),
      );
      if (existing) return existing;
    }

    // 2. MIME sniff via magic bytes; reject SVG outright (XML/JS injection risk).
    const sniffed = await sniffMime(file.buffer);
    if (!sniffed || !ALLOW_LIST.has(sniffed.mime) || sniffed.mime === 'image/svg+xml') {
      void auditLog(this.pool, {
        action: AuditAction.PRODUCT_IMAGE_REJECTED,
        subjectType: 'product_image',
        actorUserId: userId,
        metadata: { productId, reason: 'INVALID_MIME', detectedMime: sniffed?.mime ?? 'unknown' },
      }).catch(() => undefined);
      throw new BadRequestException({ code: 'INVALID_MIME' });
    }

    // 3-5. Sharp pipeline (metadata, probe, EXIF strip, post-rotation metadata).
    // F2 (Codex P2): wrap the entire pipeline in try/catch so malformed bytes
    // that pass MIME-magic surface as INVALID_IMAGE rather than 500.
    // BadRequest/PayloadTooLarge thrown intentionally inside the block escape
    // (preserve the more-specific code).
    let cleaned: Buffer;
    let cleanedWidth: number;
    let cleanedHeight: number;
    try {
      // 3. Dimension guards
      const meta = await sharp(file.buffer).metadata();
      if (!meta.width || !meta.height) {
        throw new BadRequestException({ code: 'INVALID_DIMENSIONS' });
      }
      if (meta.width < MIN_DIM || meta.height < MIN_DIM ||
          meta.width > MAX_DIM || meta.height > MAX_DIM) {
        throw new BadRequestException({ code: 'INVALID_DIMENSIONS' });
      }

      // 4. Variant byte-cap probe at the worst-case width.
      const probe = await sharp(file.buffer)
        .rotate()
        .resize({ width: PROBE_WIDTH, withoutEnlargement: true })
        .toFormat('webp', { quality: PROBE_QUALITY, effort: PROBE_EFFORT })
        .toBuffer();
      if (probe.byteLength > VARIANT_BYTE_CAP) {
        void auditLog(this.pool, {
          action: AuditAction.PRODUCT_IMAGE_REJECTED,
          subjectType: 'product_image',
          actorUserId: userId,
          metadata: { productId, reason: 'IMAGE_TOO_LARGE_AFTER_COMPRESSION', probeByteSize: probe.byteLength },
        }).catch(() => undefined);
        throw new BadRequestException({ code: 'IMAGE_TOO_LARGE_AFTER_COMPRESSION' });
      }

      // 5. EXIF strip via .rotate() (sharp default toBuffer drops metadata).
      cleaned = await sharp(file.buffer).rotate().toBuffer();

      // 5b. Re-read metadata AFTER rotation (orientation 6/8 swaps W/H).
      const cleanedMeta = await sharp(cleaned).metadata();
      if (!cleanedMeta.width || !cleanedMeta.height) {
        throw new BadRequestException({ code: 'INVALID_DIMENSIONS' });
      }
      cleanedWidth = cleanedMeta.width;
      cleanedHeight = cleanedMeta.height;
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof PayloadTooLargeException) throw err;
      throw new BadRequestException({ code: 'INVALID_IMAGE' });
    }

    // 6. Malware scan (stub returns clean in MVP; ClamAV/Defender post-SOW).
    const malware = await this.malwareScan.scan(cleaned, sniffed.mime);
    if (!malware.clean) {
      void auditLog(this.pool, {
        action: AuditAction.PRODUCT_IMAGE_REJECTED,
        subjectType: 'product_image',
        actorUserId: userId,
        metadata: { productId, reason: 'SCAN_FAILED', detail: malware.reason ?? null },
      }).catch(() => undefined);
      throw new BadRequestException({ code: 'SCAN_FAILED' });
    }

    // 7. Storage upload BEFORE the DB tx. Orphan blob on tx failure is acceptable;
    // a row-without-blob would be worse.
    const storageKey = `tenant/${shopId}/products/${productId}/${randomUUID()}.${extFromMime(sniffed.mime)}`;
    await this.storage.uploadBuffer(storageKey, cleaned, sniffed.mime);

    // 8. Tx: pessimistic product lock + cap + insert + 23505 race-loser net.
    try {
      const inserted = await withTenantTx(this.pool, async (tx) => {
        const owned = await this.repo.lockProductForTenant(tx, productId);
        if (!owned) {
          throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND' });
        }

        const count = await this.repo.countImagesInTx(tx, productId);
        if (count >= MAX_IMAGES_PER_PRODUCT) {
          throw new ConflictException({ code: 'IMAGE_LIMIT_REACHED' });
        }

        const sortOrder = await this.repo.nextSortOrderInTx(tx, productId);

        try {
          return await this.repo.insertImageInTx(tx, {
            productId,
            storageKey,
            mimeType: sniffed.mime,
            byteSize: cleaned.length,
            width: cleanedWidth,
            height: cleanedHeight,
            sortOrder,
            altText: altText ?? null,
            uploadedByUserId: userId,
            idempotencyKey: idempotencyKey ?? null,
          });
        } catch (err: unknown) {
          // F7 race-loser: a concurrent retry won the partial UNIQUE index race.
          // Re-fetch and return the winner's row.
          if (idempotencyKey && (err as { code?: string }).code === '23505') {
            const winner = await this.repo.findByIdempotencyKeyInTx(
              tx,
              productId,
              idempotencyKey,
            );
            if (winner) return winner;
          }
          throw err;
        }
      });

      await auditLog(this.pool, {
        action: AuditAction.PRODUCT_IMAGE_UPLOADED,
        subjectType: 'product_image',
        subjectId: inserted.id,
        actorUserId: userId,
        metadata: {
          imageId: inserted.id,
          productId,
          byteSize: cleaned.length,
          mimeType: sniffed.mime,
        },
      });
      return inserted;
    } catch (err) {
      // Best-effort orphan cleanup. If the tx never committed, the storage blob
      // we uploaded above has no DB row — delete it.
      this.storage.deleteBlob(storageKey).catch(() => undefined);
      throw err;
    }
  }

  async delete(productId: string, imageId: string): Promise<void> {
    const { userId } = tenantContext.requireCurrent();
    const result = await this.repo.deleteImage(productId, imageId);
    if (!result) {
      throw new NotFoundException({ code: 'IMAGE_NOT_FOUND' });
    }
    // Best-effort blob cleanup; orphan blobs are recoverable, row-without-blob
    // would be worse — DB row is already gone before we try the blob.
    this.storage.deleteBlob(result.storageKey).catch(() => undefined);
    void auditLog(this.pool, {
      action: AuditAction.PRODUCT_IMAGE_DELETED,
      subjectType: 'product_image',
      subjectId: imageId,
      actorUserId: userId,
      metadata: { imageId, productId, storageKey: result.storageKey },
    }).catch(() => undefined);
  }

  async listForProduct(productId: string): Promise<ImageRow[]> {
    return this.repo.listForProduct(productId);
  }

  async reorder(productId: string, orderedIds: string[]): Promise<ImageRow[]> {
    // F4 (Codex P2, service half): reject duplicate IDs BEFORE the repo call.
    // The repo's set-equality check (size + membership) admits ['img-1','img-1']
    // for a single-image product, which would then UPDATE the same row twice
    // with conflicting sort_order values. Guard with Set comparison up front.
    const unique = new Set(orderedIds);
    if (unique.size !== orderedIds.length) {
      throw new BadRequestException({ code: 'ORDER_LIST_DUPLICATES' });
    }

    const { userId } = tenantContext.requireCurrent();
    const rows = await this.repo.setSortOrders(productId, orderedIds);
    if (rows.length === 0) {
      throw new BadRequestException({ code: 'ORDER_LIST_MISMATCH' });
    }
    void auditLog(this.pool, {
      action: AuditAction.PRODUCT_IMAGE_REORDERED,
      subjectType: 'product_image',
      subjectId: productId,
      actorUserId: userId,
      metadata: { productId, orderedIds },
    }).catch(() => undefined);
    return rows;
  }

  async setAltText(productId: string, imageId: string, altText: string | null): Promise<ImageRow> {
    if (altText !== null && altText.length > MAX_ALT_TEXT_LENGTH) {
      throw new BadRequestException({ code: 'ALT_TEXT_TOO_LONG' });
    }
    const row = await this.repo.setAltText(productId, imageId, altText);
    if (!row) {
      throw new NotFoundException({ code: 'IMAGE_NOT_FOUND' });
    }
    return row;
  }
}

function extFromMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg': return 'jpg';
    case 'image/png':  return 'png';
    case 'image/webp': return 'webp';
    case 'image/heic': return 'heic';
    default: return 'bin';
  }
}
