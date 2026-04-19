// ok: goldsmith.no-shop-id-from-body
const { shopId } = ctx;  // from TenantContext
// ok: goldsmith.no-shop-id-from-body
const shopId2 = tenantContext.current()?.shopId;
