import { describe, it, expect, vi, beforeEach } from 'vitest';

const SHOP_ID = '00000000-0000-4000-8000-000000000001';
const PROD_ID = '11111111-1111-4000-8000-000000000001';

const mockTryOnData = {
  productId: PROD_ID,
  bodyPart: 'EAR',
  assetUrl: 'https://ik.imagekit.io/test/cutout.png',
  anchorX: 0.5,
  anchorY: 0.0,
  lengthMm: 24.5,
  widthMm: null,
  diameterMm: null,
  metal: 'GOLD',
  purity: '22K',
  netWeightG: '4.5000',
  trueToSize: true,
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

describe('fetchTryOnData', () => {
  it('returns CatalogTryOnResponse on 200', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockTryOnData), { status: 200 }),
    );
    const { fetchTryOnData } = await import('../lib/api');
    const result = await fetchTryOnData(PROD_ID, SHOP_ID);
    expect(result).toMatchObject({ productId: PROD_ID, bodyPart: 'EAR' });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining(`/products/${PROD_ID}/try-on`),
      expect.objectContaining({ headers: expect.objectContaining({ 'X-Tenant-Id': SHOP_ID }) }),
    );
  });

  it('returns null on 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 404 }));
    const { fetchTryOnData } = await import('../lib/api');
    const result = await fetchTryOnData(PROD_ID, SHOP_ID);
    expect(result).toBeNull();
  });

  it('returns null on network failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network'));
    const { fetchTryOnData } = await import('../lib/api');
    const result = await fetchTryOnData(PROD_ID, SHOP_ID);
    expect(result).toBeNull();
  });
});
