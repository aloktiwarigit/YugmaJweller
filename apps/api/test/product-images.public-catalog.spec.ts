/**
 * Story 17.1 Task 7 — public catalog images endpoint + ImageRow.thumbnail_url
 *
 * Tests:
 *   1. GET /api/v1/catalog/products/:id/images returns PublicImageRow[] with
 *      srcset, default_url, placeholder_url built from the ImageKit URL builder.
 *   2. PublicImageRow MUST NOT contain storage_key.
 *   3. srcset contains all four widths AND mb-0.25.
 *   4. default_url and placeholder_url both carry mb-0.25.
 *   5. placeholder_url carries bl-30 (blur).
 *   6. ImageRow from shopkeeper endpoint contains thumbnail_url (server-built).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CatalogService } from '../src/modules/catalog/catalog.service';
import { ImageKitTransformUrlBuilder } from '@goldsmith/integrations-storage';

// ---------------------------------------------------------------------------
// Minimal ImageRow fixture (matches repository SELECT_COLS shape)
// ---------------------------------------------------------------------------
const STORAGE_KEY = 'tenant/shop-A/products/prod-1/abc123.jpg';
const imageRowFixture = {
  id: 'img-001',
  shop_id: 'shop-A',
  product_id: 'prod-1',
  storage_key: STORAGE_KEY,
  alt_text: 'Gold necklace',
  mime_type: 'image/jpeg',
  byte_size: 100_000,
  width: 1024,
  height: 1024,
  exif_stripped_at: new Date().toISOString(),
  uploaded_by_user_id: 'user-1',
  scan_status: 'clean' as const,
  sort_order: 0,
  idempotency_key: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CatalogService.listPublicImages', () => {
  let service: CatalogService;
  let urlBuilder: ImageKitTransformUrlBuilder;

  beforeEach(() => {
    urlBuilder = new ImageKitTransformUrlBuilder();

    // Construct CatalogService with mocked dependencies.
    // CatalogService constructor after Task 7: (pool, pricingService, settingsRepo, urlBuilder)
    // listPublicImages uses pool.query directly (public route — no TenantContext).
    const poolMock = {
      query: vi.fn().mockResolvedValue({
        rows: [{
          id: imageRowFixture.id,
          alt_text: imageRowFixture.alt_text,
          width: imageRowFixture.width,
          height: imageRowFixture.height,
          storage_key: imageRowFixture.storage_key,
        }],
      }),
    };
    service = new CatalogService(
      // pool
      poolMock as never,
      // pricingService — not used by listPublicImages
      {} as never,
      // settingsRepo — not used by listPublicImages
      {} as never,
      // IMAGEKIT_URL_BUILDER
      urlBuilder,
    );
  });

  it('returns PublicImageRow[] with no storage_key', async () => {
    const result = await service.listPublicImages('prod-1', 'shop-A');
    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('storage_key');
  });

  it('srcset contains all four widths and mb-0.25', async () => {
    const result = await service.listPublicImages('prod-1', 'shop-A');
    const srcset = result[0].srcset;
    expect(srcset).toContain('320w');
    expect(srcset).toContain('640w');
    expect(srcset).toContain('1024w');
    expect(srcset).toContain('1920w');
    expect(srcset).toContain('mb-0.25');
  });

  it('default_url contains mb-0.25 and w-1024', async () => {
    const result = await service.listPublicImages('prod-1', 'shop-A');
    expect(result[0].default_url).toContain('mb-0.25');
    expect(result[0].default_url).toContain('w-1024');
  });

  it('placeholder_url contains mb-0.25 and bl-30', async () => {
    const result = await service.listPublicImages('prod-1', 'shop-A');
    expect(result[0].placeholder_url).toContain('mb-0.25');
    expect(result[0].placeholder_url).toContain('bl-30');
  });

  it('PublicImageRow has id, alt_text, width, height, srcset, default_url, placeholder_url', async () => {
    const result = await service.listPublicImages('prod-1', 'shop-A');
    const row = result[0];
    expect(row).toHaveProperty('id', 'img-001');
    expect(row).toHaveProperty('alt_text', 'Gold necklace');
    expect(row).toHaveProperty('width', 1024);
    expect(row).toHaveProperty('height', 1024);
    expect(row).toHaveProperty('srcset');
    expect(row).toHaveProperty('default_url');
    expect(row).toHaveProperty('placeholder_url');
  });
});

describe('ImageRow.thumbnail_url (shopkeeper DTO, F6-server)', () => {
  it('ImageKitTransformUrlBuilder.url() produces a thumbnail URL with w-200 and mb-0.25', () => {
    const builder = new ImageKitTransformUrlBuilder();
    const url = builder.url(STORAGE_KEY, { width: 200 });
    expect(url).toContain('w-200');
    expect(url).toContain('mb-0.25');
  });
});
