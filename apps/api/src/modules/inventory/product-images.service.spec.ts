import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import sharp from 'sharp';
import { ProductImagesService } from './product-images.service';

// Mocks for cross-package deps. Repository is injected directly.
const txMock = { query: vi.fn() };
const withTenantTxMock = vi.fn(
  async (_pool: unknown, fn: (tx: typeof txMock) => unknown) => fn(txMock),
);
vi.mock('@goldsmith/db', () => ({
  withTenantTx: (...args: unknown[]) => withTenantTxMock(...(args as [never, never])),
}));

vi.mock('@goldsmith/tenant-context', () => ({
  tenantContext: {
    requireCurrent: () => ({
      shopId: 'shop-A',
      userId: 'user-1',
      role: 'shop_admin',
      authenticated: true,
      tenant: { id: 'shop-A', slug: 'a', display_name: 'A', status: 'ACTIVE' },
    }),
  },
}));

const auditLogMock = vi.fn(async (..._args: unknown[]) => undefined);
// Inline enum members rather than spreading vi.importActual — the codebase
// convention (see billing.service.*.spec.ts, rate-lock-bookings.service.spec.ts):
// importActual flakes for enum re-exports under the hoisted factory.
vi.mock('@goldsmith/audit', () => ({
  auditLog: (...args: unknown[]) => auditLogMock(...(args as [never, never])),
  AuditAction: {
    PRODUCT_IMAGE_UPLOADED:  'PRODUCT_IMAGE_UPLOADED',
    PRODUCT_IMAGE_REJECTED:  'PRODUCT_IMAGE_REJECTED',
    PRODUCT_IMAGE_DELETED:   'PRODUCT_IMAGE_DELETED',
    PRODUCT_IMAGE_REORDERED: 'PRODUCT_IMAGE_REORDERED',
  },
}));

const repoMock = {
  lockProductForTenant: vi.fn(),
  countImagesInTx: vi.fn(),
  nextSortOrderInTx: vi.fn(),
  findByIdempotencyKeyInTx: vi.fn(),
  insertImageInTx: vi.fn(),
  deleteImage: vi.fn(),
  listForProduct: vi.fn(),
  setSortOrders: vi.fn(),
  setAltText: vi.fn(),
};

const storageMock = {
  uploadBuffer: vi.fn(async (_key: string, _data: Buffer, _mime: string) => undefined),
  deleteBlob: vi.fn(async (_key: string) => undefined),
  getPublicUrl: vi.fn(async (k: string) => `https://ik.imagekit.io/goldsmith/${k}`),
  getPresignedUploadUrl: vi.fn(),
  getPresignedReadUrl: vi.fn(),
  downloadBuffer: vi.fn(),
};

const malwareMock = { scan: vi.fn(async () => ({ clean: true as boolean, reason: undefined as string | undefined })) };

const poolMock = {} as never;

async function makeJpeg(
  width = 1000,
  height = 1000,
  opts: { withExif?: boolean; orientation?: number } = {},
): Promise<Buffer> {
  let pipeline = sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 100, b: 50 } },
  }).jpeg({ quality: 85 });
  if (opts.withExif && opts.orientation) {
    pipeline = pipeline.withMetadata({ orientation: opts.orientation });
  }
  return pipeline.toBuffer();
}

// Stub URL builder (F6-server) — returns a deterministic URL so tests can assert
// on thumbnail_url presence without depending on ImageKitTransformUrlBuilder internals.
const urlBuilderStub = { url: (key: string, _opts: unknown) => `https://ik.imagekit.io/goldsmith/${key}?tr=w-200,mb-0.25` };

function newSvc(): ProductImagesService {
  return new ProductImagesService(
    repoMock as never,
    storageMock as never,
    malwareMock as never,
    poolMock,
    urlBuilderStub as never,
  );
}

describe('ProductImagesService.upload', () => {
  let svc: ProductImagesService;

  beforeEach(() => {
    vi.clearAllMocks();
    repoMock.lockProductForTenant.mockResolvedValue({ id: 'prod-X' });
    repoMock.countImagesInTx.mockResolvedValue(0);
    repoMock.nextSortOrderInTx.mockResolvedValue(0);
    repoMock.findByIdempotencyKeyInTx.mockResolvedValue(null);
    repoMock.insertImageInTx.mockImplementation(async (_tx, input) => ({
      id: 'img-new',
      shop_id: 'shop-A',
      product_id: input.productId,
      storage_key: input.storageKey,
      alt_text: input.altText,
      mime_type: input.mimeType,
      byte_size: input.byteSize,
      width: input.width,
      height: input.height,
      exif_stripped_at: '',
      uploaded_by_user_id: input.uploadedByUserId,
      scan_status: 'clean',
      sort_order: input.sortOrder,
      idempotency_key: input.idempotencyKey,
      created_at: '',
      updated_at: '',
    }));
    malwareMock.scan.mockResolvedValue({ clean: true, reason: undefined });
    svc = newSvc();
  });

  it('happy path: validates, strips EXIF, uploads, inserts, audits', async () => {
    const file = await makeJpeg(800, 600);
    const result = await svc.upload({
      productId: 'prod-X',
      file: { buffer: file, mimeType: 'image/jpeg', size: file.length },
      altText: 'सोने की अंगूठी',
    });
    expect(storageMock.uploadBuffer).toHaveBeenCalledOnce();
    expect(repoMock.insertImageInTx).toHaveBeenCalledOnce();
    expect(auditLogMock).toHaveBeenCalledWith(
      poolMock,
      expect.objectContaining({
        action: 'PRODUCT_IMAGE_UPLOADED',
        metadata: expect.objectContaining({ imageId: 'img-new' }),
      }),
    );
    expect(result.id).toBe('img-new');
  });

  it('rejects payload over 5 MB with 413 BEFORE invoking sharp', async () => {
    const big = Buffer.alloc(6 * 1024 * 1024);
    await expect(
      svc.upload({
        productId: 'prod-X',
        file: { buffer: big, mimeType: 'image/jpeg', size: big.length },
      }),
    ).rejects.toThrow(PayloadTooLargeException);
    expect(storageMock.uploadBuffer).not.toHaveBeenCalled();
  });

  it('rejects PHP-renamed-jpg with INVALID_MIME', async () => {
    const phpAsJpg = Buffer.from('<?php system($_GET["c"]); ?>');
    await expect(
      svc.upload({
        productId: 'prod-X',
        file: { buffer: phpAsJpg, mimeType: 'image/jpeg', size: phpAsJpg.length },
      }),
    ).rejects.toThrow(BadRequestException);
    expect(auditLogMock).toHaveBeenCalledWith(
      poolMock,
      expect.objectContaining({
        action: 'PRODUCT_IMAGE_REJECTED',
        metadata: expect.objectContaining({ reason: 'INVALID_MIME' }),
      }),
    );
    expect(storageMock.uploadBuffer).not.toHaveBeenCalled();
  });

  it('rejects SVG outright (script-injection risk)', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    await expect(
      svc.upload({
        productId: 'prod-X',
        file: { buffer: svg, mimeType: 'image/svg+xml', size: svg.length },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects images with width < 200', async () => {
    const tiny = await makeJpeg(100, 100);
    await expect(
      svc.upload({
        productId: 'prod-X',
        file: { buffer: tiny, mimeType: 'image/jpeg', size: tiny.length },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // F8 (P3): 8500x300 isolates the max-width branch (300 > MIN_DIM 200, so the
  // min-height branch does not fire). Plan-as-written used 8500x100 which trips
  // both branches; the test could not distinguish them.
  it('rejects images with width > 8000 (F8 max-width branch isolated)', async () => {
    const bigDim = await makeJpeg(8500, 300);
    await expect(
      svc.upload({
        productId: 'prod-X',
        file: { buffer: bigDim, mimeType: 'image/jpeg', size: bigDim.length },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // F2 (P2): malformed bytes that pass MIME-magic (start with 0xFF 0xD8 0xFF)
  // must surface as INVALID_IMAGE, not 500. The sharp pipeline (metadata,
  // probe, rotate) is wrapped in a try/catch.
  it('returns 400 INVALID_IMAGE for corrupt JPEG bytes that pass MIME sniff (F2)', async () => {
    const corrupt = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2000, 0)]);
    await expect(
      svc.upload({
        productId: 'prod-X',
        file: { buffer: corrupt, mimeType: 'image/jpeg', size: corrupt.length },
      }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_IMAGE' } });
    expect(storageMock.uploadBuffer).not.toHaveBeenCalled();
  });

  it('rejects when 1920w probe exceeds 250 KB', async () => {
    // Source buffer must be ≤ 5 MB (body cap) but produce > 250 KB at the
    // 1920w WebP probe. 1500x1500 random noise at JPEG q=85 lands ~600 KB,
    // which after sharp.resize({ width: 1920, withoutEnlargement: true })
    // stays at 1500x1500 and re-encodes at WebP q=80 to ~500 KB — well over
    // the 250 KB cap, but well under the 5 MB body cap.
    const arr = new Uint8ClampedArray(1500 * 1500 * 3);
    for (let i = 0; i < arr.length; i++) arr[i] = (Math.random() * 256) | 0;
    const noisy = await sharp(Buffer.from(arr.buffer), {
      raw: { width: 1500, height: 1500, channels: 3 },
    })
      .jpeg({ quality: 85 })
      .toBuffer();
    expect(noisy.length).toBeLessThan(5 * 1024 * 1024);                       // sanity
    await expect(
      svc.upload({
        productId: 'prod-X',
        file: { buffer: noisy, mimeType: 'image/jpeg', size: noisy.length },
      }),
    ).rejects.toThrow(BadRequestException);
    expect(storageMock.uploadBuffer).not.toHaveBeenCalled();
  });

  it('strips EXIF metadata while preserving visual orientation', async () => {
    const exifJpeg = await makeJpeg(800, 600, { withExif: true, orientation: 6 });
    await svc.upload({
      productId: 'prod-X',
      file: { buffer: exifJpeg, mimeType: 'image/jpeg', size: exifJpeg.length },
    });
    const cleanedBuf = storageMock.uploadBuffer.mock.calls[0]?.[1] as Buffer;
    const exifrModule = await import('exifr');
    const parse = (exifrModule as { default?: { parse: (b: Buffer) => Promise<unknown> } }).default?.parse
      ?? (exifrModule as unknown as { parse: (b: Buffer) => Promise<unknown> }).parse;
    const exif = await parse(cleanedBuf);
    expect(exif).toBeUndefined();
  });

  it('stores post-rotation dimensions on EXIF-orientation-6 sources', async () => {
    const exifJpeg = await makeJpeg(4000, 3000, { withExif: true, orientation: 6 });
    await svc.upload({
      productId: 'prod-X',
      file: { buffer: exifJpeg, mimeType: 'image/jpeg', size: exifJpeg.length },
    });
    const insertCall = repoMock.insertImageInTx.mock.calls[0]?.[1];
    expect(insertCall.width).toBe(3000);
    expect(insertCall.height).toBe(4000);
  });

  it('throws CONFLICT when image cap is reached', async () => {
    repoMock.countImagesInTx.mockResolvedValue(10);
    const file = await makeJpeg(800, 600);
    await expect(
      svc.upload({
        productId: 'prod-X',
        file: { buffer: file, mimeType: 'image/jpeg', size: file.length },
      }),
    ).rejects.toThrow(ConflictException);
    expect(storageMock.deleteBlob).toHaveBeenCalledOnce();
  });

  it('throws NOT_FOUND when product is cross-tenant', async () => {
    repoMock.lockProductForTenant.mockResolvedValue(null);
    const file = await makeJpeg(800, 600);
    await expect(
      svc.upload({
        productId: 'prod-Z-other-tenant',
        file: { buffer: file, mimeType: 'image/jpeg', size: file.length },
      }),
    ).rejects.toThrow(NotFoundException);
    expect(storageMock.deleteBlob).toHaveBeenCalledOnce();
  });

  it('rejects when malware scan returns clean=false', async () => {
    malwareMock.scan.mockResolvedValueOnce({ clean: false, reason: 'EICAR' });
    const file = await makeJpeg(800, 600);
    await expect(
      svc.upload({
        productId: 'prod-X',
        file: { buffer: file, mimeType: 'image/jpeg', size: file.length },
      }),
    ).rejects.toThrow(BadRequestException);
    expect(storageMock.uploadBuffer).not.toHaveBeenCalled();
  });

  // F3 (P2, service half): upload's alt_text must enforce the same 200-char
  // limit that setAltText does, so the service does not push a row that would
  // be rejected at the DB layer or by setAltText after the fact.
  it('rejects upload alt_text > 200 chars (F3)', async () => {
    const file = await makeJpeg(800, 600);
    await expect(
      svc.upload({
        productId: 'prod-X',
        file: { buffer: file, mimeType: 'image/jpeg', size: file.length },
        altText: 'क'.repeat(201),
      }),
    ).rejects.toMatchObject({ response: { code: 'ALT_TEXT_TOO_LONG' } });
    expect(storageMock.uploadBuffer).not.toHaveBeenCalled();
  });

  // F7 (P2, service half): idempotent replay finds the existing row and
  // returns it without uploading a second blob or inserting a second row.
  it('idempotent replay returns existing row, no second upload (F7)', async () => {
    repoMock.findByIdempotencyKeyInTx.mockResolvedValueOnce({
      id: 'img-existing',
      shop_id: 'shop-A',
      product_id: 'prod-X',
      storage_key: 'k.jpg',
      alt_text: null,
      mime_type: 'image/jpeg',
      byte_size: 1234,
      width: 800,
      height: 600,
      sort_order: 0,
      idempotency_key: 'KEY-1',
      exif_stripped_at: '',
      uploaded_by_user_id: 'user-1',
      scan_status: 'clean',
      created_at: '',
      updated_at: '',
    });
    const file = await makeJpeg(800, 600);
    const r = await svc.upload({
      productId: 'prod-X',
      file: { buffer: file, mimeType: 'image/jpeg', size: file.length },
      idempotencyKey: 'KEY-1',
    });
    expect(r.id).toBe('img-existing');
    expect(storageMock.uploadBuffer).not.toHaveBeenCalled();
    expect(repoMock.insertImageInTx).not.toHaveBeenCalled();
  });

  // F7 race-loser path: two retries pass the SELECT; the loser hits the partial
  // UNIQUE index (Postgres SQLSTATE 23505) and re-fetches the winner's row.
  it('handles UNIQUE-violation race by re-fetching the winner (F7)', async () => {
    const winnerRow = {
      id: 'img-winner',
      shop_id: 'shop-A',
      product_id: 'prod-X',
      storage_key: 'k.jpg',
      alt_text: null,
      mime_type: 'image/jpeg',
      byte_size: 1234,
      width: 800,
      height: 600,
      sort_order: 0,
      idempotency_key: 'KEY-RACE',
      exif_stripped_at: '',
      uploaded_by_user_id: 'user-1',
      scan_status: 'clean' as const,
      created_at: '',
      updated_at: '',
    };
    // First lookup: nothing — both retries pass through.
    // Second lookup (after 23505 catch): returns the winner row.
    repoMock.findByIdempotencyKeyInTx
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(winnerRow);
    repoMock.insertImageInTx.mockRejectedValueOnce(
      Object.assign(new Error('duplicate key'), { code: '23505' }),
    );
    const file = await makeJpeg(800, 600);
    const r = await svc.upload({
      productId: 'prod-X',
      file: { buffer: file, mimeType: 'image/jpeg', size: file.length },
      idempotencyKey: 'KEY-RACE',
    });
    expect(r.id).toBe('img-winner');
    expect(repoMock.findByIdempotencyKeyInTx).toHaveBeenCalledTimes(2);
    // Race-loser must clean up its own (now-orphaned) blob — see opus review P2-1.
    // The deleteBlob call is detached (.catch attached, no await), so we need a
    // tick for the microtask to settle before asserting.
    await Promise.resolve();
    expect(storageMock.deleteBlob).toHaveBeenCalledTimes(1);
    // The loser's storageKey is whatever uploadBuffer was called with (the
    // distinct UUID this attempt generated). The exact key value is non-
    // deterministic (randomUUID), so assert by call shape.
    const loserKey = (storageMock.uploadBuffer.mock.calls[0]?.[0]) as string;
    expect(storageMock.deleteBlob).toHaveBeenCalledWith(loserKey);
  });
});

// Task 5: delete / listForProduct / reorder / setAltText.
//
// NB: signatures in this codebase do NOT take shopId — the repo + service
// pull tenant via `tenantContext.requireCurrent()` and `withTenantTx` (RLS).
// Audit is emitted via `auditLog(this.pool, {...}).catch(() => undefined)`,
// fire-and-forget, NOT a DI'd `audit.emit(tx, ...)` call. See
// `feedback_audit_pattern_pool_not_tx.md`.

describe('ProductImagesService.delete', () => {
  let svc: ProductImagesService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = newSvc();
  });

  it('deletes the row and the blob, emits audit', async () => {
    repoMock.deleteImage.mockResolvedValueOnce({ storageKey: 'tenant/A/products/X/k.jpg' });
    await svc.delete('prod-X', 'img-1');
    expect(repoMock.deleteImage).toHaveBeenCalledWith('prod-X', 'img-1');
    expect(storageMock.deleteBlob).toHaveBeenCalledWith('tenant/A/products/X/k.jpg');
    expect(auditLogMock).toHaveBeenCalledWith(
      poolMock,
      expect.objectContaining({
        action: 'PRODUCT_IMAGE_DELETED',
        subjectId: 'img-1',
        metadata: expect.objectContaining({
          imageId: 'img-1',
          productId: 'prod-X',
          storageKey: 'tenant/A/products/X/k.jpg',
        }),
      }),
    );
  });

  it('throws 404 when image not found in tenant', async () => {
    repoMock.deleteImage.mockResolvedValueOnce(null);
    await expect(svc.delete('prod-X', 'img-missing')).rejects.toThrow(NotFoundException);
    expect(storageMock.deleteBlob).not.toHaveBeenCalled();
  });

  it('does NOT throw if blob delete fails (best-effort)', async () => {
    repoMock.deleteImage.mockResolvedValueOnce({ storageKey: 'k.jpg' });
    storageMock.deleteBlob.mockRejectedValueOnce(new Error('blob gone'));
    await expect(svc.delete('prod-X', 'img-1')).resolves.toBeUndefined();
  });
});

describe('ProductImagesService.listForProduct', () => {
  let svc: ProductImagesService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = newSvc();
  });

  it('delegates to repo', async () => {
    const rows = [{ id: 'img-1' }] as never;
    repoMock.listForProduct.mockResolvedValueOnce(rows);
    const r = await svc.listForProduct('prod-X');
    expect(repoMock.listForProduct).toHaveBeenCalledWith('prod-X');
    // F6-server: service adds thumbnail_url via withThumbnails; use toMatchObject.
    expect(r).toMatchObject([{ id: 'img-1' }]);
  });
});

describe('ProductImagesService.reorder', () => {
  let svc: ProductImagesService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = newSvc();
  });

  it('persists the new order, emits audit', async () => {
    const reordered = [
      { id: 'img-2', sort_order: 0 },
      { id: 'img-1', sort_order: 1 },
    ] as never;
    repoMock.setSortOrders.mockResolvedValueOnce(reordered);
    const result = await svc.reorder('prod-X', ['img-2', 'img-1']);
    // F6-server: service adds thumbnail_url via withThumbnails; use toMatchObject.
    expect(result).toMatchObject([{ id: 'img-2', sort_order: 0 }, { id: 'img-1', sort_order: 1 }]);
    expect(repoMock.setSortOrders).toHaveBeenCalledWith('prod-X', ['img-2', 'img-1']);
    expect(auditLogMock).toHaveBeenCalledWith(
      poolMock,
      expect.objectContaining({
        action: 'PRODUCT_IMAGE_REORDERED',
        metadata: expect.objectContaining({
          productId: 'prod-X',
          orderedIds: ['img-2', 'img-1'],
        }),
      }),
    );
  });

  it('throws 400 ORDER_LIST_MISMATCH when set inequality (empty result from repo)', async () => {
    repoMock.setSortOrders.mockResolvedValueOnce([]);
    await expect(svc.reorder('prod-X', ['ghost-id'])).rejects.toMatchObject({
      response: { code: 'ORDER_LIST_MISMATCH' },
    });
  });

  // F4 (P2): reorder rejects duplicate IDs BEFORE calling repo, since repo
  // length-equality alone admits ['img-1','img-1'] for a 1-image product, then
  // UPDATEs the same row twice with conflicting sort_order values. Guard with
  // a Set comparison up front.
  it('rejects duplicate IDs in single-image case (F4)', async () => {
    await expect(svc.reorder('prod-X', ['img-1', 'img-1'])).rejects.toMatchObject({
      response: { code: 'ORDER_LIST_DUPLICATES' },
    });
    expect(repoMock.setSortOrders).not.toHaveBeenCalled();
  });

  it('rejects duplicate IDs in multi-image case (F4)', async () => {
    await expect(
      svc.reorder('prod-X', ['img-1', 'img-2', 'img-1']),
    ).rejects.toMatchObject({ response: { code: 'ORDER_LIST_DUPLICATES' } });
    expect(repoMock.setSortOrders).not.toHaveBeenCalled();
  });

  it('accepts unique IDs across the cap (10 entries) (F4)', async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `img-${i}`);
    const reordered = ids.map((id, i) => ({ id, sort_order: i })) as never;
    repoMock.setSortOrders.mockResolvedValueOnce(reordered);
    const result = await svc.reorder('prod-X', ids);
    // F6-server: service adds thumbnail_url via withThumbnails; use toMatchObject.
    expect(result).toMatchObject(ids.map((id, i) => ({ id, sort_order: i })));
    expect(repoMock.setSortOrders).toHaveBeenCalledWith('prod-X', ids);
  });
});

describe('ProductImagesService.setAltText', () => {
  let svc: ProductImagesService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = newSvc();
  });

  it('updates and returns the row', async () => {
    repoMock.setAltText.mockResolvedValueOnce({ id: 'img-1', alt_text: 'सोने की अंगूठी' });
    const r = await svc.setAltText('prod-X', 'img-1', 'सोने की अंगूठी');
    expect(repoMock.setAltText).toHaveBeenCalledWith('prod-X', 'img-1', 'सोने की अंगूठी');
    expect(r.alt_text).toBe('सोने की अंगूठी');
  });

  it('returns 404 when image not in tenant', async () => {
    repoMock.setAltText.mockResolvedValueOnce(null);
    await expect(
      svc.setAltText('prod-X', 'img-missing', null),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects alt text > 200 chars', async () => {
    const long = 'क'.repeat(201);
    await expect(svc.setAltText('prod-X', 'img-1', long)).rejects.toMatchObject({
      response: { code: 'ALT_TEXT_TOO_LONG' },
    });
    expect(repoMock.setAltText).not.toHaveBeenCalled();
  });
});
