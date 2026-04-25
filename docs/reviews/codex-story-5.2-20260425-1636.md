OpenAI Codex v0.121.0 (research preview)
--------
workdir: C:\Alok\Business Projects\Goldsmith
model: gpt-5.4
provider: openai
approval: never
sandbox: read-only
reasoning effort: none
reasoning summaries: none
session id: 019dc65b-5879-7f82-a4d4-0074dbf91683
--------
user
changes against '956e8d7'
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff 956e8d7742edf4bc7c8a6e78aade3d2600e1d5f2' in C:\Alok\Business Projects\Goldsmith
 succeeded in 218ms:
diff --git a/apps/api/package.json b/apps/api/package.json
index 660e756..f8a2a95 100644
--- a/apps/api/package.json
+++ b/apps/api/package.json
@@ -20,6 +20,7 @@
     "@goldsmith/audit": "workspace:*",
     "@goldsmith/cache": "workspace:*",
     "@goldsmith/compliance": "workspace:*",
+    "@goldsmith/crypto-envelope": "workspace:*",
     "@goldsmith/money": "workspace:*",
     "@goldsmith/db": "workspace:*",
     "@goldsmith/integrations-search": "workspace:*",
diff --git a/apps/api/src/modules/billing/billing.controller.ts b/apps/api/src/modules/billing/billing.controller.ts
index 06d5583..c6df190 100644
--- a/apps/api/src/modules/billing/billing.controller.ts
+++ b/apps/api/src/modules/billing/billing.controller.ts
@@ -71,4 +71,17 @@ export class BillingController {
     if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
     return this.svc.getInvoice(id);
   }
+
+  // Tax-audit PAN decryption — OWNER only, rate-limited 10 req/hr per shop.
+  // PAN is never included in audit log; only access timestamp + actor.
+  @TenantWalkerRoute({ expectedStatus: 404, pathParams: { id: '00000000-0000-0000-0000-000000000000' } })
+  @Get('/invoices/:id/pan-decrypt')
+  @Roles('shop_admin')
+  async decryptPan(
+    @TenantContextDec() ctx: TenantContext,
+    @Param('id', ParseUUIDPipe) id: string,
+  ): Promise<{ pan: string }> {
+    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
+    return this.svc.decryptInvoicePan(id);
+  }
 }
diff --git a/apps/api/src/modules/billing/billing.module.ts b/apps/api/src/modules/billing/billing.module.ts
index 9c555b0..be78ba9 100644
--- a/apps/api/src/modules/billing/billing.module.ts
+++ b/apps/api/src/modules/billing/billing.module.ts
@@ -1,8 +1,11 @@
 import { Module } from '@nestjs/common';
 import { Redis } from '@goldsmith/cache';
+import { LocalKMS } from '@goldsmith/crypto-envelope';
+import { SettingsCache } from '@goldsmith/tenant-config';
 import { AuthModule }      from '../auth/auth.module';
 import { InventoryModule } from '../inventory/inventory.module';
 import { PricingModule }   from '../pricing/pricing.module';
+import { SettingsRepository } from '../settings/settings.repository';
 import { BillingController } from './billing.controller';
 import { BillingService }    from './billing.service';
 import { BillingRepository } from './billing.repository';
@@ -13,6 +16,7 @@ import { BillingRepository } from './billing.repository';
   providers: [
     BillingService,
     BillingRepository,
+    SettingsRepository,
     {
       provide: 'BILLING_REDIS',
       useFactory: () =>
@@ -20,6 +24,15 @@ import { BillingRepository } from './billing.repository';
           maxRetriesPerRequest: 3,
         }),
     },
+    {
+      provide: 'KMS_ADAPTER',
+      useFactory: () => new LocalKMS(),
+    },
+    {
+      provide: SettingsCache,
+      useFactory: (redis: Redis) => new SettingsCache(redis, 60),
+      inject: ['BILLING_REDIS'],
+    },
   ],
 })
 export class BillingModule {}
diff --git a/apps/api/src/modules/billing/billing.repository.ts b/apps/api/src/modules/billing/billing.repository.ts
index 29e5a9e..f290068 100644
--- a/apps/api/src/modules/billing/billing.repository.ts
+++ b/apps/api/src/modules/billing/billing.repository.ts
@@ -18,6 +18,11 @@ export interface InvoiceRow {
   idempotency_key:     string;
   issued_at:           Date | null;
   created_by_user_id:  string;
+  // PAN Rule 114B encrypted fields (null when total < Rs 2,00,000)
+  pan_ciphertext:      Buffer | null;
+  pan_key_id:          string | null;
+  form60_encrypted:    Buffer | null;
+  form60_key_id:       string | null;
   created_at:          Date;
   updated_at:          Date;
 }
@@ -59,6 +64,10 @@ export interface InsertInvoiceInput {
   idempotencyKey:   string;
   issuedAt:         Date | null;
   createdByUserId:  string;
+  panCiphertext:    Buffer | null;
+  panKeyId:         string | null;
+  form60Encrypted:  Buffer | null;
+  form60KeyId:      string | null;
   items: Array<{
     productId:           string | null;
     description:         string;
@@ -92,7 +101,9 @@ const INVOICE_COLS = `
   id, shop_id, invoice_number, invoice_type,
   customer_id, customer_name, customer_phone,
   status, subtotal_paise, gst_metal_paise, gst_making_paise, total_paise,
-  idempotency_key, issued_at, created_by_user_id, created_at, updated_at
+  idempotency_key, issued_at, created_by_user_id,
+  pan_ciphertext, pan_key_id, form60_encrypted, form60_key_id,
+  created_at, updated_at
 `;
 
 const ITEM_COLS = `
@@ -120,9 +131,10 @@ export class BillingRepository {
              (shop_id, invoice_number, invoice_type,
               customer_id, customer_name, customer_phone,
               status, subtotal_paise, gst_metal_paise, gst_making_paise, total_paise,
-              idempotency_key, issued_at, created_by_user_id)
+              idempotency_key, issued_at, created_by_user_id,
+              pan_ciphertext, pan_key_id, form60_encrypted, form60_key_id)
            VALUES (current_setting('app.current_shop_id')::uuid,
-                   $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
+                   $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
            RETURNING ${INVOICE_COLS}`,
           [
             input.invoiceNumber, input.invoiceType,
@@ -130,6 +142,8 @@ export class BillingRepository {
             input.status, input.subtotalPaise, input.gstMetalPaise,
             input.gstMakingPaise, input.totalPaise,
             input.idempotencyKey, input.issuedAt, input.createdByUserId,
+            input.panCiphertext, input.panKeyId,
+            input.form60Encrypted, input.form60KeyId,
           ],
         );
         const invoice = invRes.rows[0]!;
@@ -242,6 +256,18 @@ export class BillingRepository {
     });
   }
 
+  async getInvoicePanData(
+    id: string,
+  ): Promise<Pick<InvoiceRow, 'id' | 'shop_id' | 'pan_ciphertext' | 'pan_key_id'> | null> {
+    return withTenantTx(this.pool, async (tx) => {
+      const r = await tx.query<Pick<InvoiceRow, 'id' | 'shop_id' | 'pan_ciphertext' | 'pan_key_id'>>(
+        `SELECT id, shop_id, pan_ciphertext, pan_key_id FROM invoices WHERE id = $1`,
+        [id],
+      );
+      return r.rows[0] ?? null;
+    });
+  }
+
   async listInvoices(
     limit: number,
     offset: number,
diff --git a/apps/api/src/modules/billing/billing.service.spec.ts b/apps/api/src/modules/billing/billing.service.spec.ts
index 13ed27a..687bbb3 100644
--- a/apps/api/src/modules/billing/billing.service.spec.ts
+++ b/apps/api/src/modules/billing/billing.service.spec.ts
@@ -3,6 +3,7 @@ import { describe, expect, it, vi } from 'vitest';
 import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
 import { BillingService } from './billing.service';
 import { ComplianceHardBlockError } from '@goldsmith/compliance';
+import type { MakingChargeConfig } from '@goldsmith/shared';
 
 const SHOP = '0a1b2c3d-4e5f-4000-8000-000000000000';
 const USER = '11111111-2222-4000-8000-000000000000';
@@ -59,6 +60,19 @@ function fakeInventory() {
   };
 }
 
+function fakeSettingsCache(configs: MakingChargeConfig[] | null = null) {
+  return {
+    getMakingCharges: vi.fn(async () => configs),
+    setMakingCharges: vi.fn(async () => undefined),
+  };
+}
+
+function fakeSettingsRepo(configs: MakingChargeConfig[] | null = null) {
+  return {
+    getMakingCharges: vi.fn(async () => configs),
+  };
+}
+
 function fakeRepo() {
   return {
     insertInvoice: vi.fn(async (input: any) => ({
@@ -112,6 +126,7 @@ describe('BillingService.createInvoice', () => {
     const svc  = new BillingService(
       repo as any, inv as any, fakePricing() as any,
       fakeRedis() as any, fakePool(),
+      undefined as any, undefined as any, undefined as any,
     );
 
     await expect(
@@ -148,7 +163,7 @@ describe('BillingService.createInvoice', () => {
     };
     const redis = fakeRedis({ [`invoice:idempotency:${SHOP}:idem-cached`]: JSON.stringify(cached) });
 
-    const svc = new BillingService(repo as any, inv as any, fakePricing() as any, redis as any, fakePool());
+    const svc = new BillingService(repo as any, inv as any, fakePricing() as any, redis as any, fakePool(), undefined as any, undefined as any, undefined as any);
     const out = await svc.createInvoice(
       { customerName: 'Smoke', lines: [{ description: 'x', makingChargePct: '12.00', stoneChargesPaise: '0', hallmarkFeePaise: '0' } as any] },
       'idem-cached',
@@ -164,6 +179,7 @@ describe('BillingService.createInvoice', () => {
     const svc  = new BillingService(
       repo as any, inv as any, fakePricing() as any,
       fakeRedis() as any, fakePool(),
+      undefined as any, undefined as any, undefined as any,
     );
 
     // Request line has no huid; product on record DOES (hallmarked) → must hard-block
@@ -178,7 +194,7 @@ describe('BillingService.createInvoice', () => {
   it('rejects when idempotencyKey is empty', async () => {
     const repo = fakeRepo();
     const inv  = fakeInventory();
-    const svc  = new BillingService(repo as any, inv as any, fakePricing() as any, fakeRedis() as any, fakePool());
+    const svc  = new BillingService(repo as any, inv as any, fakePricing() as any, fakeRedis() as any, fakePool(), undefined as any, undefined as any, undefined as any);
 
     await expect(
       svc.createInvoice(
@@ -206,6 +222,7 @@ describe('BillingService.createInvoice', () => {
     const svc = new BillingService(
       repo as any, inv as any, fakePricing() as any,
       fakeRedis() as any, fakePool(),
+      undefined as any, undefined as any, undefined as any,
     );
 
     await expect(
@@ -252,6 +269,7 @@ describe('BillingService.createInvoice', () => {
     const svc = new BillingService(
       repo as any, inv as any, fakePricing() as any,
       fakeRedis() as any, fakePool(),
+      undefined as any, undefined as any, undefined as any,
     );
 
     await expect(
@@ -276,3 +294,121 @@ describe('BillingService.createInvoice', () => {
     });
   });
 });
+
+describe('BillingService.createInvoice — making charges from shop settings', () => {
+  function fakeInventoryWithCategory(category: string | null) {
+    return {
+      getProductRowForBilling: vi.fn(async (id: string) => ({
+        id,
+        shop_id: SHOP,
+        metal: 'GOLD',
+        purity: 'GOLD_22K',
+        net_weight_g: '10.0000',
+        huid: null,
+        status: 'IN_STOCK',
+        category,
+      })),
+    };
+  }
+
+  it('uses category making charge from shop settings when DTO omits makingChargePct', async () => {
+    const repo = fakeRepo();
+    const sc = fakeSettingsCache([{ category: 'BRIDAL', type: 'percent', value: '14.00' }]);
+    const svc = new BillingService(
+      repo as any,
+      fakeInventoryWithCategory('BRIDAL') as any,
+      fakePricing() as any,
+      fakeRedis() as any,
+      fakePool(),
+      undefined as any,
+      sc as any,
+      fakeSettingsRepo() as any,
+    );
+
+    await svc.createInvoice(
+      { customerName: 'राम', lines: [
+        { productId: 'p1', description: 'Bridal Set', huid: 'AB12CD', stoneChargesPaise: '0', hallmarkFeePaise: '0' } as any,
+      ]},
+      'idem-bridal',
+    );
+
+    const item = (repo.insertInvoice.mock.calls[0][0] as any).items[0];
+    expect(item.makingChargePct).toBe('14.00');
+  });
+
+  it('falls back to 12.00 when category has no matching config in shop settings', async () => {
+    const repo = fakeRepo();
+    const svc = new BillingService(
+      repo as any,
+      fakeInventoryWithCategory('RINGS') as any,
+      fakePricing() as any,
+      fakeRedis() as any,
+      fakePool(),
+      undefined as any,
+      fakeSettingsCache([{ category: 'CHAINS', type: 'percent', value: '10.00' }]) as any,
+      fakeSettingsRepo() as any,
+    );
+
+    await svc.createInvoice(
+      { customerName: 'राम', lines: [
+        { productId: 'p1', description: 'Ring', huid: 'AB12CD', stoneChargesPaise: '0', hallmarkFeePaise: '0' } as any,
+      ]},
+      'idem-rings-fallback',
+    );
+
+    const item = (repo.insertInvoice.mock.calls[0][0] as any).items[0];
+    expect(item.makingChargePct).toBe('12.00');
+  });
+
+  it('DTO makingChargePct wins over shop settings', async () => {
+    const repo = fakeRepo();
+    const svc = new BillingService(
+      repo as any,
+      fakeInventoryWithCategory('BRIDAL') as any,
+      fakePricing() as any,
+      fakeRedis() as any,
+      fakePool(),
+      undefined as any,
+      fakeSettingsCache([{ category: 'BRIDAL', type: 'percent', value: '14.00' }]) as any,
+      fakeSettingsRepo() as any,
+    );
+
+    await svc.createInvoice(
+      { customerName: 'राम', lines: [
+        { productId: 'p1', description: 'Bridal Override', huid: 'AB12CD', makingChargePct: '8.00', stoneChargesPaise: '0', hallmarkFeePaise: '0' } as any,
+      ]},
+      'idem-dto-override',
+    );
+
+    const item = (repo.insertInvoice.mock.calls[0][0] as any).items[0];
+    expect(item.makingChargePct).toBe('8.00');
+  });
+
+  it('cache miss → fetches from DB via settingsRepo → uses DB value and warms cache', async () => {
+    const repo = fakeRepo();
+    const sc = fakeSettingsCache(null); // cache miss
+    const sr = fakeSettingsRepo([{ category: 'CHAINS', type: 'percent', value: '10.00' }]);
+    const svc = new BillingService(
+      repo as any,
+      fakeInventoryWithCategory('CHAINS') as any,
+      fakePricing() as any,
+      fakeRedis() as any,
+      fakePool(),
+      undefined as any,
+      sc as any,
+      sr as any,
+    );
+
+    await svc.createInvoice(
+      { customerName: 'राम', lines: [
+        { productId: 'p1', description: 'Chain', huid: 'AB12CD', stoneChargesPaise: '0', hallmarkFeePaise: '0' } as any,
+      ]},
+      'idem-cache-miss',
+    );
+
+    const item = (repo.insertInvoice.mock.calls[0][0] as any).items[0];
+    expect(item.makingChargePct).toBe('10.00');
+    expect(sr.getMakingCharges).toHaveBeenCalled();
+    expect(sc.setMakingCharges).toHaveBeenCalledWith([{ category: 'CHAINS', type: 'percent', value: '10.00' }]);
+  });
+});
diff --git a/apps/api/src/modules/billing/billing.service.ts b/apps/api/src/modules/billing/billing.service.ts
index 7d7426f..01d858e 100644
--- a/apps/api/src/modules/billing/billing.service.ts
+++ b/apps/api/src/modules/billing/billing.service.ts
@@ -12,7 +12,13 @@ import { computeProductPrice } from '@goldsmith/money';
 import {
   validateHuidPresence,
   ComplianceHardBlockError,
+  enforcePanRequired,
+  validatePanFormat,
+  normalizePan,
+  validateForm60,
 } from '@goldsmith/compliance';
+import { encryptColumn, decryptColumn, serializeEnvelope, deserializeEnvelope } from '@goldsmith/crypto-envelope';
+import type { KmsAdapter } from '@goldsmith/crypto-envelope';
 import { auditLog, AuditAction } from '@goldsmith/audit';
 import { tenantContext } from '@goldsmith/tenant-context';
 import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';
@@ -22,12 +28,15 @@ import type {
   InvoiceResponse,
   InvoiceItemResponse,
   PurityKey,
+  MakingChargeConfig,
 } from '@goldsmith/shared';
+import { SettingsCache } from '@goldsmith/tenant-config';
 import { BillingRepository, IdempotencyKeyConflictError } from './billing.repository';
 import type { InvoiceRow, InvoiceItemRow, InsertInvoiceInput } from './billing.repository';
 import { generateInvoiceNumber } from './invoice-number';
 import { InventoryService } from '../inventory/inventory.service';
 import { PricingService } from '../pricing/pricing.service';
+import { SettingsRepository } from '../settings/settings.repository';
 
 // Re-export so consumers can import from billing module without needing @goldsmith/compliance
 export { ComplianceHardBlockError };
@@ -115,18 +124,57 @@ function idemKey(shopUuid: string, key: string): string {
   return `invoice:idempotency:${shopUuid}:${key}`;
 }
 
+const PAN_DECRYPT_RATE_LIMIT_KEY = (shopUuid: string): string =>
+  `billing:pan_decrypt:${shopUuid}:${new Date().toISOString().slice(0, 13)}`; // hour bucket
+
 @Injectable()
 export class BillingService {
   private readonly logger = new Logger(BillingService.name);
 
   constructor(
-    @Inject(BillingRepository) private readonly repo: BillingRepository,
-    @Inject(InventoryService)  private readonly inventory: InventoryService,
-    @Inject(PricingService)    private readonly pricing: PricingService,
-    @Inject('BILLING_REDIS')   private readonly redis: Redis,
-    @Inject('PG_POOL')         private readonly pool: Pool,
+    @Inject(BillingRepository)  private readonly repo: BillingRepository,
+    @Inject(InventoryService)   private readonly inventory: InventoryService,
+    @Inject(PricingService)     private readonly pricing: PricingService,
+    @Inject('BILLING_REDIS')    private readonly redis: Redis,
+    @Inject('PG_POOL')          private readonly pool: Pool,
+    @Inject('KMS_ADAPTER')      private readonly kms: KmsAdapter,
+    @Inject(SettingsCache)      private readonly settingsCache: SettingsCache,
+    @Inject(SettingsRepository) private readonly settingsRepo: SettingsRepository,
   ) {}
 
+  private async resolveMakingChargePct(
+    category: string | null | undefined,
+    dtoValue: string | undefined,
+  ): Promise<string> {
+    if (dtoValue !== undefined) return dtoValue;
+    if (!category) return '12.00';
+
+    let configs: MakingChargeConfig[] | null = await this.settingsCache.getMakingCharges();
+    if (configs === null) {
+      const fromDb = await this.settingsRepo.getMakingCharges();
+      if (fromDb !== null) {
+        configs = fromDb;
+        void this.settingsCache.setMakingCharges(configs).catch(() => undefined);
+      }
+    }
+
+    const match = configs?.find((c) => c.category === category);
+    return match?.value ?? '12.00';
+  }
+
+  private async getShopKekArn(shopUuid: string): Promise<string> {
+    // shops is platform-global for SELECT; no tenant GUC needed
+    const r = await this.pool.query<{ kek_key_arn: string | null }>(
+      `SELECT kek_key_arn FROM shops WHERE id = $1`,
+      [shopUuid],
+    );
+    const arn = r.rows[0]?.kek_key_arn;
+    if (!arn) {
+      throw new BadRequestException({ code: 'shop.kek_not_provisioned' });
+    }
+    return arn;
+  }
+
   async createInvoice(
     dto: CreateInvoiceDtoType,
     idempotencyKey: string,
@@ -170,6 +218,7 @@ export class BillingService {
       net_weight_g: string;
       huid: string | null;
       status: string;
+      category: string | null;
     } | null;
 
     const resolvedProducts: ResolvedProduct[] = await Promise.all(
@@ -220,16 +269,42 @@ export class BillingService {
       })),
     );
 
+    // 3b. PAN Rule 114B pre-check (total unknown at this point, validated again after pricing).
+    // We validate PAN format here eagerly so the client gets a 400 (not 422) for malformed PAN.
+    let normalizedPan: string | null = null;
+    if (dto.pan != null) {
+      normalizedPan = normalizePan(dto.pan);
+      if (!validatePanFormat(normalizedPan)) {
+        throw new BadRequestException({
+          code: 'invoice.pan_format_invalid',
+          message: 'PAN format is invalid — expected AAAAA9999A',
+        });
+      }
+    }
+    if (dto.form60Data != null) {
+      // Validate form60 structure eagerly (400 for malformed payload)
+      validateForm60(dto.form60Data as Record<string, unknown>);
+    }
+
     // 4. Fetch live tenant rates (with override applied)
     const rates = await this.pricing.getCurrentRatesForTenant(ctx);
 
-    // 5. Compute each line server-side. Client price fields are ignored
-    //    (the Zod schema does not even accept them on input).
+    // 5. Resolve making charges per line (settings cache → DB fallback → 12% hardcoded default).
+    // DTO override wins; absent DTO value + productId → look up shop settings by category.
+    const effectiveMakingPcts: string[] = await Promise.all(
+      dto.lines.map((input, i) =>
+        this.resolveMakingChargePct(resolvedProducts[i]?.category, input.makingChargePct),
+      ),
+    );
+
+    // 5b. Compute each line server-side. Client price fields are ignored
+    //     (the Zod schema does not even accept them on input).
     type Line = {
       input: InvoiceLineDtoType;
       product: ResolvedProduct;
       computed: ReturnType<typeof computeProductPrice>;
       ratePerGramPaise: bigint;
+      effectiveMakingPct: string;
     };
 
     const lines: Line[] = dto.lines.map((input, i) => {
@@ -254,16 +329,17 @@ export class BillingService {
       }
 
       const ratePerGramPaise = (rates as unknown as Record<string, { perGramPaise: bigint }>)[purity].perGramPaise;
+      const effectiveMakingPct = effectiveMakingPcts[i];
 
       const computed = computeProductPrice({
         netWeightG,
         ratePerGramPaise,
-        makingChargePct:   input.makingChargePct,
+        makingChargePct:   effectiveMakingPct,
         stoneChargesPaise: BigInt(input.stoneChargesPaise),
         hallmarkFeePaise:  BigInt(input.hallmarkFeePaise),
       });
 
-      return { input, product, computed, ratePerGramPaise };
+      return { input, product, computed, ratePerGramPaise, effectiveMakingPct };
     });
 
     // 6. Roll up invoice totals from per-line numbers (integer-exact)
@@ -281,6 +357,30 @@ export class BillingService {
       totalPaise      += computed.totalPaise;
     }
 
+    // 6b. PAN Rule 114B hard-block — now that total is known
+    enforcePanRequired({ totalPaise, pan: normalizedPan, form60Data: dto.form60Data ?? null });
+
+    // 6c. Encrypt PAN / Form 60 if provided (only reaches here when total >= Rs 2L or pan/form60 supplied)
+    let panCiphertext: Buffer | null = null;
+    let panKeyId: string | null = null;
+    let form60Encrypted: Buffer | null = null;
+    let form60KeyId: string | null = null;
+
+    if (normalizedPan != null || dto.form60Data != null) {
+      const keyArn = await this.getShopKekArn(ctx.shopId);
+      if (normalizedPan != null) {
+        const env = await encryptColumn(this.kms, keyArn, normalizedPan);
+        panCiphertext = serializeEnvelope(env);
+        panKeyId = keyArn;
+      }
+      if (dto.form60Data != null) {
+        const form60Json = JSON.stringify(dto.form60Data);
+        const env = await encryptColumn(this.kms, keyArn, form60Json);
+        form60Encrypted = serializeEnvelope(env);
+        form60KeyId = keyArn;
+      }
+    }
+
     // 7. Generate invoice number
     const invoiceNumber = generateInvoiceNumber(ctx.shopId);
 
@@ -301,7 +401,11 @@ export class BillingService {
         idempotencyKey,
         issuedAt:       new Date(),
         createdByUserId: ctx.userId,
-        items: lines.map(({ input, product, computed, ratePerGramPaise }, i) => ({
+        panCiphertext,
+        panKeyId,
+        form60Encrypted,
+        form60KeyId,
+        items: lines.map(({ input, product, computed, ratePerGramPaise, effectiveMakingPct }, i) => ({
           productId:           input.productId ?? null,
           description:         input.description,
           hsnCode:             '7113',
@@ -314,7 +418,7 @@ export class BillingService {
           purity:              product ? (product.purity ?? null)       : (input.purity ?? null),
           netWeightG:          product ? (product.net_weight_g ?? null) : (input.netWeightG ?? null),
           ratePerGramPaise,
-          makingChargePct:     input.makingChargePct,
+          makingChargePct:     effectiveMakingPct,
           goldValuePaise:      computed.goldValuePaise,
           makingChargePaise:   computed.makingChargePaise,
           stoneChargesPaise:   computed.stoneChargesPaise,
@@ -351,7 +455,7 @@ export class BillingService {
       throw err;
     }
 
-    // 9. Audit — phone masked; PAN never collected on B2C path
+    // 9. Audit — phone masked; PAN plaintext NEVER logged; only key_id for traceability
     const maskedPhone = maskPhone(dto.customerPhone ?? null);
     void auditLog(this.pool, {
       action: AuditAction.INVOICE_CREATED,
@@ -359,11 +463,14 @@ export class BillingService {
       subjectId: result.invoice.id,
       actorUserId: ctx.userId,
       after: {
-        invoice_number: result.invoice.invoice_number,
-        customer_name:  result.invoice.customer_name,
+        invoice_number:        result.invoice.invoice_number,
+        customer_name:         result.invoice.customer_name,
         customer_phone_masked: maskedPhone,
-        line_count:     result.items.length,
-        total_paise:    result.invoice.total_paise.toString(),
+        line_count:            result.items.length,
+        total_paise:           result.invoice.total_paise.toString(),
+        pan_captured:          panCiphertext !== null,
+        pan_key_id:            panKeyId ?? undefined,
+        form60_captured:       form60Encrypted !== null,
       },
     }).catch(() => undefined);
     void auditLog(this.pool, {
@@ -383,6 +490,44 @@ export class BillingService {
     return resp;
   }
 
+  async decryptInvoicePan(id: string): Promise<{ pan: string }> {
+    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;
+
+    // Rate-limit: 10 decryptions per shop per hour (Redis counter; best-effort)
+    const rateKey = PAN_DECRYPT_RATE_LIMIT_KEY(ctx.shopId);
+    try {
+      const count = await this.redis.incr(rateKey);
+      if (count === 1) {
+        await this.redis.expire(rateKey, 3600);
+      }
+      if (count > 10) {
+        throw new BadRequestException({ code: 'invoice.pan_decrypt_rate_limit_exceeded' });
+      }
+    } catch (e) {
+      if (e instanceof BadRequestException) throw e;
+      this.logger.warn(`Redis rate-limit check failed for PAN decrypt: ${String(e)}`);
+    }
+
+    const row = await this.repo.getInvoicePanData(id);
+    if (!row) throw new NotFoundException({ code: 'invoice.not_found' });
+    if (!row.pan_ciphertext || !row.pan_key_id) {
+      throw new NotFoundException({ code: 'invoice.pan_not_captured' });
+    }
+
+    const envelope = deserializeEnvelope(row.pan_ciphertext, row.pan_key_id);
+    const plaintext = await decryptColumn(this.kms, envelope);
+
+    void auditLog(this.pool, {
+      action: AuditAction.INVOICE_PAN_ACCESSED,
+      subjectType: 'invoice',
+      subjectId: id,
+      actorUserId: ctx.userId,
+      metadata: { pan_key_id: row.pan_key_id },
+    }).catch(() => undefined);
+
+    return { pan: plaintext };
+  }
+
   async getInvoice(id: string): Promise<InvoiceResponse> {
     const found = await this.repo.getInvoice(id);
     if (!found) throw new NotFoundException({ code: 'invoice.not_found' });
diff --git a/apps/api/src/modules/inventory/inventory.repository.ts b/apps/api/src/modules/inventory/inventory.repository.ts
index b9de4c7..39c214d 100644
--- a/apps/api/src/modules/inventory/inventory.repository.ts
+++ b/apps/api/src/modules/inventory/inventory.repository.ts
@@ -47,6 +47,17 @@ export interface FailedRow {
   error: string;
 }
 
+export interface ProductBillingRow {
+  id: string;
+  shop_id: string;
+  metal: string;
+  purity: string;
+  net_weight_g: string;
+  huid: string | null;
+  status: string;
+  category: string | null;
+}
+
 export interface ValuationProductRow {
   id: string;
   metal: string;
@@ -112,6 +123,20 @@ export class InventoryRepository {
     });
   }
 
+  async getProductBillingRow(id: string): Promise<ProductBillingRow | null> {
+    return withTenantTx(this.pool, async (tx) => {
+      const r = await tx.query<ProductBillingRow>(
+        `SELECT p.id, p.shop_id, p.metal, p.purity, p.net_weight_g, p.huid, p.status,
+                pc.name AS category
+           FROM products p
+           LEFT JOIN product_categories pc ON pc.id = p.category_id
+          WHERE p.id = $1`,
+        [id],
+      );
+      return r.rows[0] ?? null;
+    });
+  }
+
   async listProducts(filter: ListProductsFilter): Promise<ProductRow[]> {
     return withTenantTx(this.pool, async (tx) => {
       const conditions: string[] = [];
diff --git a/apps/api/src/modules/inventory/inventory.service.ts b/apps/api/src/modules/inventory/inventory.service.ts
index 0dbe606..5f0bdda 100644
--- a/apps/api/src/modules/inventory/inventory.service.ts
+++ b/apps/api/src/modules/inventory/inventory.service.ts
@@ -99,19 +99,11 @@ export class InventoryService {
    */
   async getProductRowForBilling(id: string): Promise<{
     id: string; shop_id: string; metal: string; purity: string;
-    net_weight_g: string; huid: string | null; status: string;
+    net_weight_g: string; huid: string | null; status: string; category: string | null;
   }> {
-    const row = await this.repo.getProduct(id);
+    const row = await this.repo.getProductBillingRow(id);
     if (!row) throw new NotFoundException({ code: 'inventory.product_not_found' });
-    return {
-      id:           row.id,
-      shop_id:      row.shop_id,
-      metal:        row.metal,
-      purity:       row.purity,
-      net_weight_g: row.net_weight_g,
-      huid:         row.huid,
-      status:       row.status,
-    };
+    return row;
   }
 
   async updateProduct(id: string, dto: UpdateProductDto): Promise<ProductResponse> {
diff --git a/apps/api/test/billing.integration.test.ts b/apps/api/test/billing.integration.test.ts
index cd2b931..f7a51cd 100644
--- a/apps/api/test/billing.integration.test.ts
+++ b/apps/api/test/billing.integration.test.ts
@@ -125,6 +125,9 @@ function buildBillingService(): BillingService {
     pricingSvc,
     redis as never,      // BILLING_REDIS
     pool as never,       // PG_POOL
+    undefined as never,  // KMS_ADAPTER — not used in these tests
+    undefined as never,  // SettingsCache — all tests pass makingChargePct explicitly
+    undefined as never,  // SettingsRepository — see above
   );
 }
 
diff --git a/apps/api/test/compliance-gates/pan-114b.test.ts b/apps/api/test/compliance-gates/pan-114b.test.ts
new file mode 100644
index 0000000..3dd454a
--- /dev/null
+++ b/apps/api/test/compliance-gates/pan-114b.test.ts
@@ -0,0 +1,144 @@
+import { describe, expect, it } from 'vitest';
+import { readFileSync } from 'node:fs';
+import { resolve } from 'node:path';
+import { enforcePanRequired, ComplianceHardBlockError, PAN_THRESHOLD_PAISE } from '@goldsmith/compliance';
+import { encryptColumn, decryptColumn, serializeEnvelope, deserializeEnvelope, LocalKMS } from '@goldsmith/crypto-envelope';
+
+/**
+ * PAN Rule 114B compliance gate.
+ * Static-analysis block: verifies billing service source never removes the gate.
+ * Unit block: threshold boundary, encryption round-trip, tenant isolation.
+ */
+describe('PAN Rule 114B — billing service static checks', () => {
+  const svcSrc = readFileSync(
+    resolve(__dirname, '../../src/modules/billing/billing.service.ts'),
+    'utf8',
+  );
+
+  it('imports enforcePanRequired from @goldsmith/compliance', () => {
+    expect(svcSrc).toMatch(
+      /import\s*\{[^}]*enforcePanRequired[^}]*\}\s*from\s*['"]@goldsmith\/compliance['"]/,
+    );
+  });
+
+  it('calls enforcePanRequired before insertInvoice (hard-block fires before DB write)', () => {
+    const idxEnforce = svcSrc.indexOf('enforcePanRequired(');
+    const idxInsert  = svcSrc.indexOf('this.repo.insertInvoice(');
+    expect(idxEnforce).toBeGreaterThan(-1);
+    expect(idxInsert).toBeGreaterThan(-1);
+    expect(idxEnforce).toBeLessThan(idxInsert);
+  });
+
+  it('imports encryptColumn from @goldsmith/crypto-envelope (PAN encrypted at app layer)', () => {
+    expect(svcSrc).toMatch(
+      /import\s*\{[^}]*encryptColumn[^}]*\}\s*from\s*['"]@goldsmith\/crypto-envelope['"]/,
+    );
+  });
+
+  it('does NOT log PAN plaintext in audit (no bare `pan: normalizedPan`)', () => {
+    const auditAfterBlocks = [...svcSrc.matchAll(/after:\s*\{[^}]+\}/gs)].map((m) => m[0]);
+    for (const block of auditAfterBlocks) {
+      expect(block).not.toMatch(/\bpan:\s*normalized/);
+      expect(block).not.toMatch(/\bpan:\s*dto\.pan/);
+    }
+  });
+
+  it('does NOT include pan_ciphertext inside any audit `after:` object literal', () => {
+    // Extract each `after: { ... }` block (single-line) and verify none contain pan_ciphertext.
+    const auditAfterBlocks = [...svcSrc.matchAll(/after:\s*\{[^}]+\}/g)].map((m) => m[0]);
+    for (const block of auditAfterBlocks) {
+      expect(block).not.toMatch(/pan_ciphertext/i);
+    }
+  });
+
+  it('normalizes PAN before encryption (normalizePan called)', () => {
+    expect(svcSrc).toMatch(/normalizePan\(/);
+  });
+
+  it('validates PAN format before encryption (validatePanFormat called)', () => {
+    expect(svcSrc).toMatch(/validatePanFormat\(/);
+  });
+
+  it('uses per-tenant KEK from shops table (getShopKekArn called)', () => {
+    expect(svcSrc).toMatch(/getShopKekArn\(/);
+  });
+
+  it('encrypts Form60 data before DB write (serializeEnvelope used)', () => {
+    const idxForm60Encrypt = svcSrc.indexOf('form60Encrypted = serializeEnvelope');
+    const idxInsert        = svcSrc.indexOf('this.repo.insertInvoice(');
+    expect(idxForm60Encrypt).toBeGreaterThan(-1);
+    expect(idxForm60Encrypt).toBeLessThan(idxInsert);
+  });
+});
+
+describe('PAN Rule 114B — threshold boundary', () => {
+  it('PAN_THRESHOLD_PAISE is exactly Rs 2,00,000 in paise (20_000_000n)', () => {
+    expect(PAN_THRESHOLD_PAISE).toBe(20_000_000n);
+  });
+
+  it('Rs 1,99,999 (19_999_900n paise) — no block without PAN', () => {
+    expect(() =>
+      enforcePanRequired({ totalPaise: 19_999_900n, pan: null, form60Data: null }),
+    ).not.toThrow();
+  });
+
+  it('Rs 2,00,000 (20_000_000n paise) — blocks without PAN', () => {
+    expect(() =>
+      enforcePanRequired({ totalPaise: 20_000_000n, pan: null, form60Data: null }),
+    ).toThrow(ComplianceHardBlockError);
+  });
+
+  it('Rs 2,00,001 (20_000_100n paise) — blocks without PAN', () => {
+    expect(() =>
+      enforcePanRequired({ totalPaise: 20_000_100n, pan: null, form60Data: null }),
+    ).toThrow(ComplianceHardBlockError);
+  });
+
+  it('Rs 2,00,001 — passes with valid PAN', () => {
+    expect(() =>
+      enforcePanRequired({ totalPaise: 20_000_100n, pan: 'ABCDE1234F', form60Data: null }),
+    ).not.toThrow();
+  });
+
+  it('Rs 2,00,001 — passes with Form60', () => {
+    expect(() =>
+      enforcePanRequired({
+        totalPaise:  20_000_100n,
+        pan:         null,
+        form60Data:  { name: 'Ram', address: 'Ayodhya UP', reasonForNoPan: 'no card', estimatedAnnualIncomePaise: '0' },
+      }),
+    ).not.toThrow();
+  });
+});
+
+describe('PAN Rule 114B — encryption round-trip + tenant isolation', () => {
+  it('PAN encrypt → serialize → deserialize → decrypt returns original', async () => {
+    const kms    = new LocalKMS();
+    const keyArn = await kms.createKeyForTenant('shop-test');
+    const pan    = 'ABCDE1234F';
+    const env    = await encryptColumn(kms, keyArn, pan);
+    const buf    = serializeEnvelope(env);
+    const deser  = deserializeEnvelope(buf, keyArn);
+    const plain  = await decryptColumn(kms, deser);
+    expect(plain).toBe(pan);
+  });
+
+  it('PAN never appears in serialized bytes as plaintext UTF-8', async () => {
+    const kms    = new LocalKMS();
+    const keyArn = await kms.createKeyForTenant('shop-test-2');
+    const pan    = 'ABCDE1234F';
+    const env    = await encryptColumn(kms, keyArn, pan);
+    const buf    = serializeEnvelope(env);
+    expect(buf.toString('utf8')).not.toContain(pan);
+  });
+
+  it('Tenant A key cannot decrypt Tenant B ciphertext (per-tenant isolation)', async () => {
+    const kms  = new LocalKMS();
+    const arnA = await kms.createKeyForTenant('tenant-a');
+    const arnB = await kms.createKeyForTenant('tenant-b');
+    const env  = await encryptColumn(kms, arnA, 'ABCDE1234F');
+    const buf  = serializeEnvelope(env);
+    const wrongDeser = deserializeEnvelope(buf, arnB);
+    await expect(decryptColumn(kms, wrongDeser)).rejects.toThrow();
+  });
+});
diff --git a/apps/shopkeeper/app/billing/new.tsx b/apps/shopkeeper/app/billing/new.tsx
index 1ce23f6..71c3c8c 100644
--- a/apps/shopkeeper/app/billing/new.tsx
+++ b/apps/shopkeeper/app/billing/new.tsx
@@ -15,19 +15,36 @@ import { BillingLineBuilder } from '@goldsmith/ui-mobile';
 import type { BillingLineValue, BillingLineProduct } from '@goldsmith/ui-mobile';
 import { api } from '../../src/api/client';
 import type { InvoiceResponse, CreateInvoiceDtoType } from '@goldsmith/shared';
+import { PanPromptSheet } from '../../src/features/billing/components/PanPromptSheet';
+import type { PanSubmitPayload } from '../../src/features/billing/components/PanPromptSheet';
 
 interface DraftLine extends BillingLineValue {
   product: BillingLineProduct;
   ratePerGramPaise: bigint;
 }
 
+function extractTotalPaise(errorBody: unknown): bigint {
+  try {
+    const body = errorBody as { totalPaise?: string } | null | undefined;
+    const raw = body?.totalPaise;
+    if (raw != null) return BigInt(raw);
+  } catch {
+    // fall through
+  }
+  return 0n;
+}
+
 export default function NewInvoiceScreen(): JSX.Element {
   const [customerName, setCustomerName] = useState<string>('');
   const [customerPhone, setCustomerPhone] = useState<string>('');
   const [lines, setLines] = useState<DraftLine[]>([]);
   const [idempotencyKey] = useState<string>(() => uuid());
 
-  const createInvoice = useMutation<InvoiceResponse, Error, CreateInvoiceDtoType>({
+  // PAN prompt state
+  const [panRequired, setPanRequired] = useState(false);
+  const [panTotalPaise, setPanTotalPaise] = useState(0n);
+
+  const createInvoice = useMutation<InvoiceResponse, unknown, CreateInvoiceDtoType>({
     mutationFn: async (dto) => {
       const res = await api.post<InvoiceResponse>('/api/v1/billing/invoices', dto, {
         headers: { 'Idempotency-Key': idempotencyKey },
@@ -37,10 +54,41 @@ export default function NewInvoiceScreen(): JSX.Element {
     // eslint-disable-next-line @typescript-eslint/no-explicit-any
     onSuccess: (invoice) => router.replace(`/billing/${invoice.id}` as any),
     onError: (err) => {
-      Alert.alert('Invoice generate नहीं हुआ', err.message);
+      const body = (err as { response?: { data?: unknown; status?: number } }).response?.data;
+      const status = (err as { response?: { status?: number } }).response?.status;
+      const code = (body as { code?: string } | null | undefined)?.code;
+
+      if (status === 422 && code === 'compliance.pan_required') {
+        const totalPaise = extractTotalPaise(body);
+        setPanTotalPaise(totalPaise);
+        setPanRequired(true);
+        return;
+      }
+
+      const message = (body as { detail?: string } | null | undefined)?.detail
+        ?? (err instanceof Error ? err.message : 'कुछ गलत हो गया');
+      Alert.alert('Invoice generate नहीं हुआ', message);
     },
   });
 
+  const buildDto = useCallback(
+    (extra: PanSubmitPayload = {}): CreateInvoiceDtoType => ({
+      customerName: customerName.trim(),
+      ...(customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {}),
+      lines: lines.map((l) => ({
+        productId: l.productId,
+        description: l.description,
+        huid: l.huid,
+        makingChargePct: l.makingChargePct,
+        stoneChargesPaise: '0',
+        hallmarkFeePaise: '0',
+      })),
+      ...(extra.pan ? { pan: extra.pan } : {}),
+      ...(extra.form60Data ? { form60Data: extra.form60Data } : {}),
+    }),
+    [customerName, customerPhone, lines],
+  );
+
   const onLineChange = useCallback((index: number, next: BillingLineValue) => {
     setLines((curr) => {
       const copy = [...curr];
@@ -58,80 +106,90 @@ export default function NewInvoiceScreen(): JSX.Element {
       Alert.alert('कम से कम एक आइटम जोड़ें');
       return;
     }
-    const dto: CreateInvoiceDtoType = {
-      customerName: customerName.trim(),
-      ...(customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {}),
-      lines: lines.map((l) => ({
-        productId: l.productId,
-        description: l.description,
-        huid: l.huid,
-        makingChargePct: l.makingChargePct,
-        stoneChargesPaise: '0',
-        hallmarkFeePaise: '0',
-      })),
-    };
-    createInvoice.mutate(dto);
-  }, [customerName, customerPhone, lines, createInvoice]);
+    createInvoice.mutate(buildDto());
+  }, [customerName, lines, buildDto, createInvoice]);
+
+  const onPanSubmit = useCallback(
+    (payload: PanSubmitPayload) => {
+      setPanRequired(false);
+      createInvoice.mutate(buildDto(payload));
+    },
+    [buildDto, createInvoice],
+  );
+
+  const onPanCancel = useCallback(() => {
+    setPanRequired(false);
+    setPendingDto(null);
+  }, []);
 
   return (
-    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
-      <Text style={styles.title}>नया Invoice</Text>
-
-      <View style={styles.card}>
-        <Text style={styles.label}>ग्राहक का नाम *</Text>
-        <TextInput
-          value={customerName}
-          onChangeText={setCustomerName}
-          style={styles.input}
-          placeholder="नाम लिखें"
-          accessibilityLabel="Customer name"
-        />
-        <Text style={styles.label}>फ़ोन (वैकल्पिक)</Text>
-        <TextInput
-          value={customerPhone}
-          onChangeText={setCustomerPhone}
-          keyboardType="phone-pad"
-          maxLength={10}
-          style={styles.input}
-          placeholder="9876543210"
-          accessibilityLabel="Customer phone"
-        />
-      </View>
-
-      {lines.map((line, i) => (
-        <BillingLineBuilder
-          key={`${line.productId}-${i}`}
-          product={line.product}
-          ratePerGramPaise={line.ratePerGramPaise}
-          makingChargePct={line.makingChargePct}
-          onChange={(v) => onLineChange(i, v)}
-        />
-      ))}
-
-      <Pressable
-        // eslint-disable-next-line @typescript-eslint/no-explicit-any
-        onPress={() => router.push('/billing/scan' as any)}
-        style={styles.scanButton}
-        accessibilityRole="button"
-      >
-        <Text style={styles.scanButtonText}>+ बारकोड स्कैन करें</Text>
-      </Pressable>
-
-      <Pressable
-        onPress={onSubmit}
-        disabled={createInvoice.isPending}
-        style={[
-          styles.submitButton,
-          createInvoice.isPending && styles.submitButtonDisabled,
-        ]}
-        accessibilityRole="button"
-        accessibilityState={{ disabled: createInvoice.isPending }}
-      >
-        <Text style={styles.submitButtonText}>
-          {createInvoice.isPending ? 'Generate हो रहा है...' : 'Invoice बनाएं'}
-        </Text>
-      </Pressable>
-    </ScrollView>
+    <>
+      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
+        <Text style={styles.title}>नया Invoice</Text>
+
+        <View style={styles.card}>
+          <Text style={styles.label}>ग्राहक का नाम *</Text>
+          <TextInput
+            value={customerName}
+            onChangeText={setCustomerName}
+            style={styles.input}
+            placeholder="नाम लिखें"
+            accessibilityLabel="Customer name"
+          />
+          <Text style={styles.label}>फ़ोन (वैकल्पिक)</Text>
+          <TextInput
+            value={customerPhone}
+            onChangeText={setCustomerPhone}
+            keyboardType="phone-pad"
+            maxLength={10}
+            style={styles.input}
+            placeholder="9876543210"
+            accessibilityLabel="Customer phone"
+          />
+        </View>
+
+        {lines.map((line, i) => (
+          <BillingLineBuilder
+            key={`${line.productId}-${i}`}
+            product={line.product}
+            ratePerGramPaise={line.ratePerGramPaise}
+            makingChargePct={line.makingChargePct}
+            onChange={(v) => onLineChange(i, v)}
+          />
+        ))}
+
+        <Pressable
+          // eslint-disable-next-line @typescript-eslint/no-explicit-any
+          onPress={() => router.push('/billing/scan' as any)}
+          style={styles.scanButton}
+          accessibilityRole="button"
+        >
+          <Text style={styles.scanButtonText}>+ बारकोड स्कैन करें</Text>
+        </Pressable>
+
+        <Pressable
+          onPress={onSubmit}
+          disabled={createInvoice.isPending}
+          style={[
+            styles.submitButton,
+            createInvoice.isPending && styles.submitButtonDisabled,
+          ]}
+          accessibilityRole="button"
+          accessibilityState={{ disabled: createInvoice.isPending }}
+        >
+          <Text style={styles.submitButtonText}>
+            {createInvoice.isPending ? 'Generate हो रहा है...' : 'Invoice बनाएं'}
+          </Text>
+        </Pressable>
+      </ScrollView>
+
+      <PanPromptSheet
+        visible={panRequired}
+        totalPaise={panTotalPaise}
+        onSubmit={onPanSubmit}
+        onCancel={onPanCancel}
+      />
+    </>
   );
 }
 
diff --git a/apps/shopkeeper/src/features/billing/components/PanPromptSheet.tsx b/apps/shopkeeper/src/features/billing/components/PanPromptSheet.tsx
new file mode 100644
index 0000000..bc54566
--- /dev/null
+++ b/apps/shopkeeper/src/features/billing/components/PanPromptSheet.tsx
@@ -0,0 +1,383 @@
+import React, { useState, useRef, useEffect, useCallback } from 'react';
+import {
+  View,
+  Text,
+  TextInput,
+  Pressable,
+  Modal,
+  Animated,
+  ScrollView,
+  StyleSheet,
+  AccessibilityInfo,
+} from 'react-native';
+
+// PAN format: 5 uppercase alpha + 4 digits + 1 uppercase alpha
+const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
+
+export interface Form60Data {
+  name: string;
+  address: string;
+  reasonForNoPan: string;
+  estimatedAnnualIncomePaise: string;
+}
+
+export interface PanSubmitPayload {
+  pan?: string;
+  form60Data?: Form60Data;
+}
+
+interface Props {
+  visible: boolean;
+  totalPaise: bigint;
+  onSubmit: (payload: PanSubmitPayload) => void;
+  onCancel: () => void;
+}
+
+function formatRupees(paise: bigint): string {
+  const rupees = Number(paise) / 100;
+  return `₹${rupees.toLocaleString('hi-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
+}
+
+type Tab = 'pan' | 'form60';
+
+export function PanPromptSheet({ visible, totalPaise, onSubmit, onCancel }: Props): JSX.Element {
+  const slideAnim = useRef(new Animated.Value(400)).current;
+  const [tab, setTab] = useState<Tab>('pan');
+  const [pan, setPan] = useState('');
+  const [panError, setPanError] = useState<string | null>(null);
+  const [f60Name, setF60Name] = useState('');
+  const [f60Address, setF60Address] = useState('');
+  const [f60Reason, setF60Reason] = useState('');
+  const [f60Income, setF60Income] = useState('');
+
+  useEffect(() => {
+    if (visible) {
+      Animated.spring(slideAnim, {
+        toValue: 0,
+        useNativeDriver: true,
+        bounciness: 0,
+      }).start();
+    } else {
+      slideAnim.setValue(400);
+      setPan('');
+      setPanError(null);
+      setTab('pan');
+      setF60Name('');
+      setF60Address('');
+      setF60Reason('');
+      setF60Income('');
+    }
+  }, [visible, slideAnim]);
+
+  const handlePanChange = useCallback((text: string) => {
+    const normalized = text.toUpperCase().replace(/\s+/g, '');
+    setPan(normalized);
+    if (normalized.length === 10) {
+      setPanError(PAN_RE.test(normalized) ? null : 'PAN format सही नहीं — जैसे: ABCDE1234F');
+    } else {
+      setPanError(null);
+    }
+  }, []);
+
+  const handleSubmitPan = useCallback(() => {
+    const normalized = pan.toUpperCase().trim();
+    if (!PAN_RE.test(normalized)) {
+      setPanError('PAN format सही नहीं — जैसे: ABCDE1234F');
+      AccessibilityInfo.announceForAccessibility('PAN format सही नहीं');
+      return;
+    }
+    onSubmit({ pan: normalized });
+  }, [pan, onSubmit]);
+
+  const handleSubmitForm60 = useCallback(() => {
+    if (!f60Name.trim() || !f60Address.trim() || !f60Reason.trim() || !f60Income.trim()) {
+      AccessibilityInfo.announceForAccessibility('सभी फ़ील्ड ज़रूरी हैं');
+      return;
+    }
+    const incomePaise = f60Income.replace(/[^0-9]/g, '');
+    onSubmit({
+      form60Data: {
+        name: f60Name.trim(),
+        address: f60Address.trim(),
+        reasonForNoPan: f60Reason.trim(),
+        estimatedAnnualIncomePaise: incomePaise || '0',
+      },
+    });
+  }, [f60Name, f60Address, f60Reason, f60Income, onSubmit]);
+
+  return (
+    <Modal
+      visible={visible}
+      transparent
+      animationType="none"
+      onRequestClose={onCancel}
+      accessibilityViewIsModal
+    >
+      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="रद्द करें" />
+      <Animated.View
+        style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
+        accessibilityRole="dialog"
+        accessibilityLabel="PAN या Form 60 ज़रूरी है"
+      >
+        <View style={styles.handle} />
+
+        <Text style={styles.heading}>PAN या Form 60 ज़रूरी है</Text>
+        <Text style={styles.totalLine}>
+          कुल बिल: <Text style={styles.totalAmount}>{formatRupees(totalPaise)}</Text>
+        </Text>
+        <Text style={styles.subtext}>
+          ₹2,00,000 से अधिक के bill पर PAN या Form 60 आवश्यक है (Rule 114B)।
+        </Text>
+
+        {/* Tab selector */}
+        <View style={styles.tabRow} accessibilityRole="tablist">
+          <Pressable
+            style={[styles.tabBtn, tab === 'pan' && styles.tabBtnActive]}
+            onPress={() => setTab('pan')}
+            accessibilityRole="tab"
+            accessibilityState={{ selected: tab === 'pan' }}
+          >
+            <Text style={[styles.tabText, tab === 'pan' && styles.tabTextActive]}>
+              PAN दर्ज करें
+            </Text>
+          </Pressable>
+          <Pressable
+            style={[styles.tabBtn, tab === 'form60' && styles.tabBtnActive]}
+            onPress={() => setTab('form60')}
+            accessibilityRole="tab"
+            accessibilityState={{ selected: tab === 'form60' }}
+          >
+            <Text style={[styles.tabText, tab === 'form60' && styles.tabTextActive]}>
+              Form 60 भरें
+            </Text>
+          </Pressable>
+        </View>
+
+        <ScrollView style={styles.tabContent} keyboardShouldPersistTaps="handled">
+          {tab === 'pan' ? (
+            <View>
+              <Text style={styles.fieldLabel}>PAN नंबर</Text>
+              <TextInput
+                value={pan}
+                onChangeText={handlePanChange}
+                style={[styles.input, panError ? styles.inputError : null]}
+                placeholder="ABCDE1234F"
+                autoCapitalize="characters"
+                maxLength={10}
+                keyboardType="default"
+                accessibilityLabel="PAN नंबर"
+                accessibilityHint="10 अक्षर — 5 अक्षर, 4 अंक, 1 अक्षर"
+              />
+              {panError ? (
+                <Text style={styles.errorText} accessibilityRole="alert">
+                  {panError}
+                </Text>
+              ) : null}
+
+              <Pressable
+                onPress={handleSubmitPan}
+                style={styles.submitBtn}
+                accessibilityRole="button"
+              >
+                <Text style={styles.submitBtnText}>PAN ज़मा करें</Text>
+              </Pressable>
+            </View>
+          ) : (
+            <View>
+              <Text style={styles.fieldLabel}>नाम *</Text>
+              <TextInput
+                value={f60Name}
+                onChangeText={setF60Name}
+                style={styles.input}
+                placeholder="ग्राहक का पूरा नाम"
+                accessibilityLabel="ग्राहक का नाम"
+              />
+
+              <Text style={styles.fieldLabel}>पता *</Text>
+              <TextInput
+                value={f60Address}
+                onChangeText={setF60Address}
+                style={[styles.input, styles.inputMultiline]}
+                placeholder="पूरा पता"
+                multiline
+                numberOfLines={3}
+                accessibilityLabel="पूरा पता"
+              />
+
+              <Text style={styles.fieldLabel}>PAN न होने का कारण *</Text>
+              <TextInput
+                value={f60Reason}
+                onChangeText={setF60Reason}
+                style={styles.input}
+                placeholder="जैसे: PAN card नहीं बना है"
+                accessibilityLabel="PAN न होने का कारण"
+              />
+
+              <Text style={styles.fieldLabel}>अनुमानित वार्षिक आय (₹) *</Text>
+              <TextInput
+                value={f60Income}
+                onChangeText={setF60Income}
+                style={styles.input}
+                placeholder="0"
+                keyboardType="numeric"
+                accessibilityLabel="अनुमानित वार्षिक आय रुपये में"
+              />
+
+              <Pressable
+                onPress={handleSubmitForm60}
+                style={styles.submitBtn}
+                accessibilityRole="button"
+              >
+                <Text style={styles.submitBtnText}>Form 60 ज़मा करें</Text>
+              </Pressable>
+            </View>
+          )}
+        </ScrollView>
+
+        <Pressable onPress={onCancel} style={styles.cancelBtn} accessibilityRole="button">
+          <Text style={styles.cancelText}>रद्द करें</Text>
+        </Pressable>
+      </Animated.View>
+    </Modal>
+  );
+}
+
+const styles = StyleSheet.create({
+  backdrop: {
+    ...StyleSheet.absoluteFillObject,
+    backgroundColor: 'rgba(0,0,0,0.45)',
+  },
+  sheet: {
+    position: 'absolute',
+    bottom: 0,
+    left: 0,
+    right: 0,
+    backgroundColor: '#fdf6ec',
+    borderTopLeftRadius: 20,
+    borderTopRightRadius: 20,
+    paddingHorizontal: 20,
+    paddingBottom: 32,
+    maxHeight: '90%',
+  },
+  handle: {
+    width: 40,
+    height: 4,
+    backgroundColor: '#d6d3d1',
+    borderRadius: 2,
+    alignSelf: 'center',
+    marginTop: 10,
+    marginBottom: 16,
+  },
+  heading: {
+    fontSize: 20,
+    fontWeight: '700',
+    fontFamily: 'NotoSansDevanagari',
+    color: '#1c1917',
+    marginBottom: 6,
+  },
+  totalLine: {
+    fontSize: 16,
+    fontFamily: 'NotoSansDevanagari',
+    color: '#44403c',
+    marginBottom: 4,
+  },
+  totalAmount: {
+    fontWeight: '700',
+    color: '#92400e',
+    fontSize: 18,
+  },
+  subtext: {
+    fontSize: 13,
+    fontFamily: 'NotoSansDevanagari',
+    color: '#78716c',
+    marginBottom: 16,
+    lineHeight: 18,
+  },
+  tabRow: {
+    flexDirection: 'row',
+    borderRadius: 8,
+    borderWidth: 1,
+    borderColor: '#e7e5e4',
+    marginBottom: 16,
+    overflow: 'hidden',
+  },
+  tabBtn: {
+    flex: 1,
+    paddingVertical: 12,
+    alignItems: 'center',
+    backgroundColor: '#ffffff',
+    minHeight: 48,
+  },
+  tabBtnActive: {
+    backgroundColor: '#92400e',
+  },
+  tabText: {
+    fontSize: 14,
+    fontFamily: 'NotoSansDevanagari',
+    color: '#78716c',
+  },
+  tabTextActive: {
+    color: '#ffffff',
+    fontWeight: '600',
+  },
+  tabContent: {
+    flexGrow: 0,
+  },
+  fieldLabel: {
+    fontSize: 14,
+    fontFamily: 'NotoSansDevanagari',
+    color: '#44403c',
+    marginBottom: 4,
+  },
+  input: {
+    borderWidth: 1,
+    borderColor: '#d6d3d1',
+    borderRadius: 8,
+    paddingHorizontal: 12,
+    paddingVertical: 12,
+    fontSize: 16,
+    marginBottom: 12,
+    backgroundColor: '#ffffff',
+    minHeight: 48,
+    color: '#1c1917',
+  },
+  inputError: {
+    borderColor: '#dc2626',
+  },
+  inputMultiline: {
+    minHeight: 80,
+    textAlignVertical: 'top',
+  },
+  errorText: {
+    color: '#dc2626',
+    fontSize: 13,
+    fontFamily: 'NotoSansDevanagari',
+    marginTop: -8,
+    marginBottom: 10,
+  },
+  submitBtn: {
+    backgroundColor: '#92400e',
+    borderRadius: 10,
+    paddingVertical: 16,
+    alignItems: 'center',
+    marginTop: 4,
+    marginBottom: 12,
+    minHeight: 48,
+  },
+  submitBtnText: {
+    color: '#ffffff',
+    fontSize: 16,
+    fontWeight: '700',
+    fontFamily: 'NotoSansDevanagari',
+  },
+  cancelBtn: {
+    paddingVertical: 14,
+    alignItems: 'center',
+    minHeight: 48,
+  },
+  cancelText: {
+    color: '#78716c',
+    fontSize: 16,
+    fontFamily: 'NotoSansDevanagari',
+  },
+});
diff --git a/packages/audit/src/audit-actions.ts b/packages/audit/src/audit-actions.ts
index e4bc2a2..f2c0fa0 100644
--- a/packages/audit/src/audit-actions.ts
+++ b/packages/audit/src/audit-actions.ts
@@ -37,4 +37,5 @@ export enum AuditAction {
   INVENTORY_STOCK_MOVEMENT_RECORDED = 'INVENTORY_STOCK_MOVEMENT_RECORDED',
   INVOICE_CREATED                  = 'INVOICE_CREATED',
   INVOICE_ISSUED                   = 'INVOICE_ISSUED',
+  INVOICE_PAN_ACCESSED             = 'INVOICE_PAN_ACCESSED',
 }
diff --git a/packages/compliance/src/index.ts b/packages/compliance/src/index.ts
index c2baa5e..b6e1eca 100644
--- a/packages/compliance/src/index.ts
+++ b/packages/compliance/src/index.ts
@@ -5,3 +5,10 @@ export { applyGstSplit } from './gst/split';
 export { ComplianceHardBlockError } from './errors';
 export { validateHuidPresence } from './huid/validate-presence';
 export type { HuidPresenceLine } from './huid/validate-presence';
+export { validatePanFormat, normalizePan } from './pan/validate-format';
+export {
+  PAN_THRESHOLD_PAISE,
+  enforcePanRequired,
+  validateForm60,
+} from './pan/rule-114b';
+export type { PanEnforcementInput } from './pan/rule-114b';
diff --git a/packages/compliance/src/pan/rule-114b.test.ts b/packages/compliance/src/pan/rule-114b.test.ts
new file mode 100644
index 0000000..b775e9b
--- /dev/null
+++ b/packages/compliance/src/pan/rule-114b.test.ts
@@ -0,0 +1,123 @@
+import { describe, expect, it } from 'vitest';
+import { enforcePanRequired, validateForm60, PAN_THRESHOLD_PAISE } from './rule-114b';
+import { ComplianceHardBlockError } from '../errors';
+
+const THRESHOLD = PAN_THRESHOLD_PAISE; // 20_000_000n (Rs 2,00,000)
+
+describe('PAN_THRESHOLD_PAISE', () => {
+  it('equals Rs 2,00,000 × 100 paise', () => {
+    expect(THRESHOLD).toBe(20_000_000n);
+  });
+});
+
+describe('enforcePanRequired', () => {
+  it('passes when total is below threshold with no PAN (Rs 1,99,999)', () => {
+    expect(() =>
+      enforcePanRequired({ totalPaise: 19_999_900n, pan: null, form60Data: null }),
+    ).not.toThrow();
+  });
+
+  it('passes when total is exactly threshold with valid PAN (Rs 2,00,000)', () => {
+    expect(() =>
+      enforcePanRequired({ totalPaise: 20_000_000n, pan: 'ABCDE1234F', form60Data: null }),
+    ).not.toThrow();
+  });
+
+  it('hard-blocks when total equals threshold and no PAN or Form60 (Rs 2,00,000)', () => {
+    expect(() =>
+      enforcePanRequired({ totalPaise: 20_000_000n, pan: null, form60Data: null }),
+    ).toThrow(ComplianceHardBlockError);
+  });
+
+  it('hard-blocks when total is above threshold and no PAN or Form60 (Rs 2,00,001)', () => {
+    expect(() =>
+      enforcePanRequired({ totalPaise: 20_000_100n, pan: null, form60Data: null }),
+    ).toThrow(ComplianceHardBlockError);
+  });
+
+  it('emits compliance.pan_required code', () => {
+    try {
+      enforcePanRequired({ totalPaise: 20_000_100n, pan: undefined, form60Data: null });
+      throw new Error('expected throw');
+    } catch (e) {
+      expect((e as ComplianceHardBlockError).code).toBe('compliance.pan_required');
+      expect((e as ComplianceHardBlockError).meta.thresholdPaise).toBe(THRESHOLD.toString());
+    }
+  });
+
+  it('passes when total is above threshold and valid PAN provided', () => {
+    expect(() =>
+      enforcePanRequired({ totalPaise: 20_000_100n, pan: 'ABCDE1234F', form60Data: null }),
+    ).not.toThrow();
+  });
+
+  it('passes when total is above threshold and Form60 provided', () => {
+    expect(() =>
+      enforcePanRequired({
+        totalPaise: 20_000_100n,
+        pan: null,
+        form60Data: { name: 'Ram', address: 'Ayodhya', reasonForNoPan: 'No card', estimatedAnnualIncomePaise: '100000' },
+      }),
+    ).not.toThrow();
+  });
+
+  it('rejects an empty-string PAN (treated as missing)', () => {
+    expect(() =>
+      enforcePanRequired({ totalPaise: 20_000_100n, pan: '   ', form60Data: null }),
+    ).toThrow(ComplianceHardBlockError);
+  });
+
+  it('passes when total is zero (no PAN required)', () => {
+    expect(() =>
+      enforcePanRequired({ totalPaise: 0n, pan: null, form60Data: null }),
+    ).not.toThrow();
+  });
+});
+
+describe('validateForm60', () => {
+  const validForm60 = {
+    name: 'Ram Kumar',
+    address: '12 Main Road, Ayodhya',
+    reasonForNoPan: 'PAN card not yet issued',
+    estimatedAnnualIncomePaise: '500000',
+  };
+
+  it('passes with all required fields present', () => {
+    expect(() => validateForm60(validForm60)).not.toThrow();
+  });
+
+  it('throws when name is missing', () => {
+    const bad = { ...validForm60, name: '' };
+    expect(() => validateForm60(bad)).toThrow(ComplianceHardBlockError);
+    try {
+      validateForm60(bad);
+    } catch (e) {
+      expect((e as ComplianceHardBlockError).code).toBe('compliance.form60_incomplete');
+      expect((e as ComplianceHardBlockError).meta.missingFields).toContain('name');
+    }
+  });
+
+  it('throws when address is missing', () => {
+    const bad = { ...validForm60, address: '   ' };
+    expect(() => validateForm60(bad)).toThrow(ComplianceHardBlockError);
+  });
+
+  it('throws when reasonForNoPan is missing', () => {
+    const bad = { ...validForm60, reasonForNoPan: '' };
+    expect(() => validateForm60(bad)).toThrow(ComplianceHardBlockError);
+  });
+
+  it('throws when estimatedAnnualIncomePaise is missing', () => {
+    const bad = { ...validForm60, estimatedAnnualIncomePaise: '' };
+    expect(() => validateForm60(bad)).toThrow(ComplianceHardBlockError);
+  });
+
+  it('reports all missing fields at once', () => {
+    try {
+      validateForm60({ name: '', address: '', reasonForNoPan: '', estimatedAnnualIncomePaise: '' });
+    } catch (e) {
+      const missing = (e as ComplianceHardBlockError).meta.missingFields as string[];
+      expect(missing).toHaveLength(4);
+    }
+  });
+});
diff --git a/packages/compliance/src/pan/rule-114b.ts b/packages/compliance/src/pan/rule-114b.ts
new file mode 100644
index 0000000..d46750a
--- /dev/null
+++ b/packages/compliance/src/pan/rule-114b.ts
@@ -0,0 +1,38 @@
+import { ComplianceHardBlockError } from '../errors';
+
+export const PAN_THRESHOLD_PAISE = 20_000_000n; // Rs 2,00,000 × 100 paise
+
+export interface PanEnforcementInput {
+  totalPaise:  bigint;
+  pan:         string | null | undefined;
+  form60Data:  Record<string, unknown> | null | undefined;
+}
+
+// Call BEFORE any DB write in the billing service.
+// Throws if total >= threshold AND neither PAN nor Form 60 is provided.
+export function enforcePanRequired(input: PanEnforcementInput): void {
+  if (input.totalPaise < PAN_THRESHOLD_PAISE) return;
+  if (input.pan != null && String(input.pan).trim().length > 0) return;
+  if (input.form60Data != null && typeof input.form60Data === 'object') return;
+  throw new ComplianceHardBlockError('compliance.pan_required', {
+    totalPaise:     input.totalPaise.toString(),
+    thresholdPaise: PAN_THRESHOLD_PAISE.toString(),
+  });
+}
+
+const FORM60_REQUIRED_FIELDS: ReadonlyArray<string> = [
+  'name',
+  'address',
+  'reasonForNoPan',
+  'estimatedAnnualIncomePaise',
+];
+
+export function validateForm60(data: Record<string, unknown>): void {
+  const missing = FORM60_REQUIRED_FIELDS.filter((f) => {
+    const v = data[f];
+    return v == null || String(v).trim().length === 0;
+  });
+  if (missing.length > 0) {
+    throw new ComplianceHardBlockError('compliance.form60_incomplete', { missingFields: missing });
+  }
+}
diff --git a/packages/compliance/src/pan/validate-format.test.ts b/packages/compliance/src/pan/validate-format.test.ts
new file mode 100644
index 0000000..9ef1baa
--- /dev/null
+++ b/packages/compliance/src/pan/validate-format.test.ts
@@ -0,0 +1,54 @@
+import { describe, expect, it } from 'vitest';
+import { validatePanFormat, normalizePan } from './validate-format';
+
+describe('normalizePan', () => {
+  it('uppercases and strips whitespace', () => {
+    expect(normalizePan('  abcde1234f  ')).toBe('ABCDE1234F');
+  });
+  it('returns already-normalized PAN unchanged', () => {
+    expect(normalizePan('ABCDE1234F')).toBe('ABCDE1234F');
+  });
+});
+
+describe('validatePanFormat', () => {
+  it('accepts a canonical valid PAN', () => {
+    expect(validatePanFormat('ABCDE1234F')).toBe(true);
+  });
+
+  it('accepts another valid PAN', () => {
+    expect(validatePanFormat('PQRST9876Z')).toBe(true);
+  });
+
+  it('auto-uppercases before validating', () => {
+    expect(validatePanFormat('abcde1234f')).toBe(true);
+  });
+
+  it('rejects PAN with digit in position 1-5 (wrong alpha positions)', () => {
+    expect(validatePanFormat('1BCDE1234F')).toBe(false);
+  });
+
+  it('rejects PAN with letter in numeric positions 6-9', () => {
+    expect(validatePanFormat('ABCDEA234F')).toBe(false);
+    expect(validatePanFormat('ABCDE12A4F')).toBe(false);
+  });
+
+  it('rejects PAN with digit in position 10', () => {
+    expect(validatePanFormat('ABCDE12341')).toBe(false);
+  });
+
+  it('rejects a 9-char PAN (too short)', () => {
+    expect(validatePanFormat('ABCDE123F')).toBe(false);
+  });
+
+  it('rejects an 11-char PAN (too long)', () => {
+    expect(validatePanFormat('ABCDE12345F')).toBe(false);
+  });
+
+  it('rejects an empty string', () => {
+    expect(validatePanFormat('')).toBe(false);
+  });
+
+  it('rejects a PAN with special characters', () => {
+    expect(validatePanFormat('ABCDE-234F')).toBe(false);
+  });
+});
diff --git a/packages/compliance/src/pan/validate-format.ts b/packages/compliance/src/pan/validate-format.ts
new file mode 100644
index 0000000..5c806d0
--- /dev/null
+++ b/packages/compliance/src/pan/validate-format.ts
@@ -0,0 +1,10 @@
+// PAN format: AAAAA9999A — 5 uppercase alpha, 4 numeric, 1 uppercase alpha (no checksum)
+const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
+
+export function normalizePan(pan: string): string {
+  return pan.toUpperCase().replace(/\s+/g, '');
+}
+
+export function validatePanFormat(pan: string): boolean {
+  return PAN_RE.test(normalizePan(pan));
+}
diff --git a/packages/crypto-envelope/src/envelope-codec.test.ts b/packages/crypto-envelope/src/envelope-codec.test.ts
new file mode 100644
index 0000000..3220d26
--- /dev/null
+++ b/packages/crypto-envelope/src/envelope-codec.test.ts
@@ -0,0 +1,49 @@
+import { describe, expect, it } from 'vitest';
+import { serializeEnvelope, deserializeEnvelope } from './envelope-codec';
+import { encryptColumn, decryptColumn } from './envelope';
+import { LocalKMS } from './local-kms';
+
+describe('serializeEnvelope / deserializeEnvelope', () => {
+  it('round-trips through serialize → deserialize', async () => {
+    const kms = new LocalKMS();
+    const keyArn = await kms.createKeyForTenant('shop-test');
+    const plaintext = 'ABCDE1234F';
+
+    const envelope = await encryptColumn(kms, keyArn, plaintext);
+    const serialized = serializeEnvelope(envelope);
+    const deserialized = deserializeEnvelope(serialized, keyArn);
+
+    expect(deserialized.keyArn).toBe(keyArn);
+    expect(deserialized.iv).toEqual(envelope.iv);
+    expect(deserialized.tag).toEqual(envelope.tag);
+    expect(deserialized.ciphertext).toEqual(envelope.ciphertext);
+    expect(deserialized.encryptedDek).toEqual(envelope.encryptedDek);
+
+    const decrypted = await decryptColumn(kms, deserialized);
+    expect(decrypted).toBe(plaintext);
+  });
+
+  it('is a Buffer', async () => {
+    const kms = new LocalKMS();
+    const keyArn = await kms.createKeyForTenant('shop-test-2');
+    const envelope = await encryptColumn(kms, keyArn, 'test');
+    const serialized = serializeEnvelope(envelope);
+    expect(Buffer.isBuffer(serialized)).toBe(true);
+  });
+
+  it('throws on buffer too short to be valid', () => {
+    expect(() => deserializeEnvelope(Buffer.alloc(10), 'arn')).toThrow('too short');
+  });
+
+  it('per-tenant key isolation: decrypting with wrong key ARN fails', async () => {
+    const kms = new LocalKMS();
+    const arnA = await kms.createKeyForTenant('shop-A');
+    const arnB = await kms.createKeyForTenant('shop-B');
+
+    const envelope = await encryptColumn(kms, arnA, 'ABCDE1234F');
+    const serialized = serializeEnvelope(envelope);
+    // Deserialize with correct bytes but wrong key ARN → decryptDataKey will fail
+    const deserialized = deserializeEnvelope(serialized, arnB);
+    await expect(decryptColumn(kms, deserialized)).rejects.toThrow();
+  });
+});
diff --git a/packages/crypto-envelope/src/envelope-codec.ts b/packages/crypto-envelope/src/envelope-codec.ts
new file mode 100644
index 0000000..67e76cb
--- /dev/null
+++ b/packages/crypto-envelope/src/envelope-codec.ts
@@ -0,0 +1,35 @@
+import type { EnvelopeCiphertext } from './envelope';
+
+/**
+ * Wire format (no keyArn — stored separately as pan_key_id / form60_key_id):
+ *   [4 bytes uint32 BE: encryptedDek length]
+ *   [encryptedDek bytes]
+ *   [12 bytes: iv]
+ *   [16 bytes: GCM auth tag]
+ *   [remaining bytes: ciphertext]
+ */
+export function serializeEnvelope(env: Omit<EnvelopeCiphertext, 'keyArn'>): Buffer {
+  const dekLen = env.encryptedDek.byteLength;
+  const lenBuf = Buffer.allocUnsafe(4);
+  lenBuf.writeUInt32BE(dekLen, 0);
+  return Buffer.concat([lenBuf, env.encryptedDek, env.iv, env.tag, env.ciphertext]);
+}
+
+export function deserializeEnvelope(
+  buf: Buffer,
+  keyArn: string,
+): EnvelopeCiphertext {
+  if (buf.byteLength < 4 + 12 + 16) {
+    throw new Error('envelope-codec: buffer too short to be a valid envelope');
+  }
+  const dekLen = buf.readUInt32BE(0);
+  let offset = 4;
+  const encryptedDek = buf.subarray(offset, offset + dekLen);
+  offset += dekLen;
+  const iv = buf.subarray(offset, offset + 12);
+  offset += 12;
+  const tag = buf.subarray(offset, offset + 16);
+  offset += 16;
+  const ciphertext = buf.subarray(offset);
+  return { ciphertext, encryptedDek, iv, tag, keyArn };
+}
diff --git a/packages/crypto-envelope/src/index.ts b/packages/crypto-envelope/src/index.ts
index d93d5da..6b00397 100644
--- a/packages/crypto-envelope/src/index.ts
+++ b/packages/crypto-envelope/src/index.ts
@@ -1,3 +1,4 @@
 export type { KmsAdapter } from './kms-adapter';
 export { LocalKMS } from './local-kms';
 export { encryptColumn, decryptColumn, type EnvelopeCiphertext } from './envelope';
+export { serializeEnvelope, deserializeEnvelope } from './envelope-codec';
diff --git a/packages/db/src/migrations/0023_invoice_pan.sql b/packages/db/src/migrations/0023_invoice_pan.sql
new file mode 100644
index 0000000..7d005ad
--- /dev/null
+++ b/packages/db/src/migrations/0023_invoice_pan.sql
@@ -0,0 +1,10 @@
+-- Story 5.3: PAN Rule 114B — encrypted PAN storage on invoices
+-- Both columns nullable: only populated when invoice total >= Rs 2,00,000
+ALTER TABLE invoices
+  ADD COLUMN pan_ciphertext   BYTEA,
+  ADD COLUMN pan_key_id       TEXT,
+  ADD COLUMN form60_encrypted BYTEA,
+  ADD COLUMN form60_key_id    TEXT;
+
+-- pan_key_id references the KEK ARN used for this invoice (from shops.kek_key_arn at time of write)
+-- Retained for key-rotation audit trail even after decryption
diff --git a/packages/db/src/schema/invoices.ts b/packages/db/src/schema/invoices.ts
index aa5655d..82c9193 100644
--- a/packages/db/src/schema/invoices.ts
+++ b/packages/db/src/schema/invoices.ts
@@ -1,6 +1,10 @@
-import { uuid, text, bigint, timestamp } from 'drizzle-orm/pg-core';
+import { uuid, text, bigint, timestamp, customType } from 'drizzle-orm/pg-core';
 import { tenantScopedTable } from './_helpers/tenantScopedTable';
 
+const bytea = customType<{ data: Buffer }>({
+  dataType() { return 'bytea'; },
+});
+
 export const invoices = tenantScopedTable('invoices', {
   id:                   uuid('id').primaryKey().defaultRandom(),
   invoice_number:       text('invoice_number').notNull(),
@@ -16,6 +20,11 @@ export const invoices = tenantScopedTable('invoices', {
   idempotency_key:      text('idempotency_key').notNull(),
   issued_at:            timestamp('issued_at',  { withTimezone: true }),
   created_by_user_id:   uuid('created_by_user_id').notNull(),
+  // PAN Rule 114B — encrypted at app layer; only present when total >= Rs 2,00,000
+  pan_ciphertext:       bytea('pan_ciphertext'),
+  pan_key_id:           text('pan_key_id'),
+  form60_encrypted:     bytea('form60_encrypted'),
+  form60_key_id:        text('form60_key_id'),
   created_at:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
   updated_at:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
 });
diff --git a/packages/shared/src/schemas/invoice.schema.ts b/packages/shared/src/schemas/invoice.schema.ts
index b55423b..656ca08 100644
--- a/packages/shared/src/schemas/invoice.schema.ts
+++ b/packages/shared/src/schemas/invoice.schema.ts
@@ -14,15 +14,28 @@ export const InvoiceLineSchema = z.object({
   metalType:         z.enum(['GOLD', 'SILVER', 'PLATINUM']).optional(),
   purity:            z.string().max(16).optional(),
   netWeightG:        DecimalWeight.optional(),
-  makingChargePct:   DecimalPct.default('12.00'),
+  makingChargePct:   DecimalPct.optional(),
   stoneChargesPaise: PaiseString.default('0'),
   hallmarkFeePaise:  PaiseString.default('0'),
 });
 
+// PAN: AAAAA9999A — 5 uppercase alpha + 4 digits + 1 uppercase alpha (Rule 114B)
+const PanString = z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN format — e.g. ABCDE1234F');
+
+export const Form60Schema = z.object({
+  name:                       z.string().min(2),
+  address:                    z.string().min(10),
+  reasonForNoPan:             z.string().min(5),
+  estimatedAnnualIncomePaise: z.string().regex(/^\d+$/, 'Must be a non-negative integer string'),
+});
+
 export const CreateInvoiceSchema = z.object({
   customerName:  z.string().min(1).max(200),
   customerPhone: PhoneIndia.optional(),
   lines:         z.array(InvoiceLineSchema).min(1).max(50),
+  // PAN Rule 114B — required when total >= Rs 2,00,000; normalised to uppercase before sending
+  pan:           PanString.optional(),
+  form60Data:    Form60Schema.optional(),
 });
 
 export type CreateInvoiceDtoType = z.infer<typeof CreateInvoiceSchema>;
diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
index 119b9cd..2455d48 100644
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@ -64,6 +64,9 @@ importers:
       '@goldsmith/compliance':
         specifier: workspace:*
         version: link:../../packages/compliance
+      '@goldsmith/crypto-envelope':
+        specifier: workspace:*
+        version: link:../../packages/crypto-envelope
       '@goldsmith/db':
         specifier: workspace:*
         version: link:../../packages/db

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff 956e8d7742edf4bc7c8a6e78aade3d2600e1d5f2 -- apps/api/src/modules/billing/billing.service.ts' in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff --stat 956e8d7742edf4bc7c8a6e78aade3d2600e1d5f2' in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff 956e8d7742edf4bc7c8a6e78aade3d2600e1d5f2 --name-only' in C:\Alok\Business Projects\Goldsmith
 succeeded in 205ms:
diff --git a/apps/api/src/modules/billing/billing.service.ts b/apps/api/src/modules/billing/billing.service.ts
index 7d7426f..01d858e 100644
--- a/apps/api/src/modules/billing/billing.service.ts
+++ b/apps/api/src/modules/billing/billing.service.ts
@@ -12,7 +12,13 @@ import { computeProductPrice } from '@goldsmith/money';
 import {
   validateHuidPresence,
   ComplianceHardBlockError,
+  enforcePanRequired,
+  validatePanFormat,
+  normalizePan,
+  validateForm60,
 } from '@goldsmith/compliance';
+import { encryptColumn, decryptColumn, serializeEnvelope, deserializeEnvelope } from '@goldsmith/crypto-envelope';
+import type { KmsAdapter } from '@goldsmith/crypto-envelope';
 import { auditLog, AuditAction } from '@goldsmith/audit';
 import { tenantContext } from '@goldsmith/tenant-context';
 import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';
@@ -22,12 +28,15 @@ import type {
   InvoiceResponse,
   InvoiceItemResponse,
   PurityKey,
+  MakingChargeConfig,
 } from '@goldsmith/shared';
+import { SettingsCache } from '@goldsmith/tenant-config';
 import { BillingRepository, IdempotencyKeyConflictError } from './billing.repository';
 import type { InvoiceRow, InvoiceItemRow, InsertInvoiceInput } from './billing.repository';
 import { generateInvoiceNumber } from './invoice-number';
 import { InventoryService } from '../inventory/inventory.service';
 import { PricingService } from '../pricing/pricing.service';
+import { SettingsRepository } from '../settings/settings.repository';
 
 // Re-export so consumers can import from billing module without needing @goldsmith/compliance
 export { ComplianceHardBlockError };
@@ -115,18 +124,57 @@ function idemKey(shopUuid: string, key: string): string {
   return `invoice:idempotency:${shopUuid}:${key}`;
 }
 
+const PAN_DECRYPT_RATE_LIMIT_KEY = (shopUuid: string): string =>
+  `billing:pan_decrypt:${shopUuid}:${new Date().toISOString().slice(0, 13)}`; // hour bucket
+
 @Injectable()
 export class BillingService {
   private readonly logger = new Logger(BillingService.name);
 
   constructor(
-    @Inject(BillingRepository) private readonly repo: BillingRepository,
-    @Inject(InventoryService)  private readonly inventory: InventoryService,
-    @Inject(PricingService)    private readonly pricing: PricingService,
-    @Inject('BILLING_REDIS')   private readonly redis: Redis,
-    @Inject('PG_POOL')         private readonly pool: Pool,
+    @Inject(BillingRepository)  private readonly repo: BillingRepository,
+    @Inject(InventoryService)   private readonly inventory: InventoryService,
+    @Inject(PricingService)     private readonly pricing: PricingService,
+    @Inject('BILLING_REDIS')    private readonly redis: Redis,
+    @Inject('PG_POOL')          private readonly pool: Pool,
+    @Inject('KMS_ADAPTER')      private readonly kms: KmsAdapter,
+    @Inject(SettingsCache)      private readonly settingsCache: SettingsCache,
+    @Inject(SettingsRepository) private readonly settingsRepo: SettingsRepository,
   ) {}
 
+  private async resolveMakingChargePct(
+    category: string | null | undefined,
+    dtoValue: string | undefined,
+  ): Promise<string> {
+    if (dtoValue !== undefined) return dtoValue;
+    if (!category) return '12.00';
+
+    let configs: MakingChargeConfig[] | null = await this.settingsCache.getMakingCharges();
+    if (configs === null) {
+      const fromDb = await this.settingsRepo.getMakingCharges();
+      if (fromDb !== null) {
+        configs = fromDb;
+        void this.settingsCache.setMakingCharges(configs).catch(() => undefined);
+      }
+    }
+
+    const match = configs?.find((c) => c.category === category);
+    return match?.value ?? '12.00';
+  }
+
+  private async getShopKekArn(shopUuid: string): Promise<string> {
+    // shops is platform-global for SELECT; no tenant GUC needed
+    const r = await this.pool.query<{ kek_key_arn: string | null }>(
+      `SELECT kek_key_arn FROM shops WHERE id = $1`,
+      [shopUuid],
+    );
+    const arn = r.rows[0]?.kek_key_arn;
+    if (!arn) {
+      throw new BadRequestException({ code: 'shop.kek_not_provisioned' });
+    }
+    return arn;
+  }
+
   async createInvoice(
     dto: CreateInvoiceDtoType,
     idempotencyKey: string,
@@ -170,6 +218,7 @@ export class BillingService {
       net_weight_g: string;
       huid: string | null;
       status: string;
+      category: string | null;
     } | null;
 
     const resolvedProducts: ResolvedProduct[] = await Promise.all(
@@ -220,16 +269,42 @@ export class BillingService {
       })),
     );
 
+    // 3b. PAN Rule 114B pre-check (total unknown at this point, validated again after pricing).
+    // We validate PAN format here eagerly so the client gets a 400 (not 422) for malformed PAN.
+    let normalizedPan: string | null = null;
+    if (dto.pan != null) {
+      normalizedPan = normalizePan(dto.pan);
+      if (!validatePanFormat(normalizedPan)) {
+        throw new BadRequestException({
+          code: 'invoice.pan_format_invalid',
+          message: 'PAN format is invalid — expected AAAAA9999A',
+        });
+      }
+    }
+    if (dto.form60Data != null) {
+      // Validate form60 structure eagerly (400 for malformed payload)
+      validateForm60(dto.form60Data as Record<string, unknown>);
+    }
+
     // 4. Fetch live tenant rates (with override applied)
     const rates = await this.pricing.getCurrentRatesForTenant(ctx);
 
-    // 5. Compute each line server-side. Client price fields are ignored
-    //    (the Zod schema does not even accept them on input).
+    // 5. Resolve making charges per line (settings cache → DB fallback → 12% hardcoded default).
+    // DTO override wins; absent DTO value + productId → look up shop settings by category.
+    const effectiveMakingPcts: string[] = await Promise.all(
+      dto.lines.map((input, i) =>
+        this.resolveMakingChargePct(resolvedProducts[i]?.category, input.makingChargePct),
+      ),
+    );
+
+    // 5b. Compute each line server-side. Client price fields are ignored
+    //     (the Zod schema does not even accept them on input).
     type Line = {
       input: InvoiceLineDtoType;
       product: ResolvedProduct;
       computed: ReturnType<typeof computeProductPrice>;
       ratePerGramPaise: bigint;
+      effectiveMakingPct: string;
     };
 
     const lines: Line[] = dto.lines.map((input, i) => {
@@ -254,16 +329,17 @@ export class BillingService {
       }
 
       const ratePerGramPaise = (rates as unknown as Record<string, { perGramPaise: bigint }>)[purity].perGramPaise;
+      const effectiveMakingPct = effectiveMakingPcts[i];
 
       const computed = computeProductPrice({
         netWeightG,
         ratePerGramPaise,
-        makingChargePct:   input.makingChargePct,
+        makingChargePct:   effectiveMakingPct,
         stoneChargesPaise: BigInt(input.stoneChargesPaise),
         hallmarkFeePaise:  BigInt(input.hallmarkFeePaise),
       });
 
-      return { input, product, computed, ratePerGramPaise };
+      return { input, product, computed, ratePerGramPaise, effectiveMakingPct };
     });
 
     // 6. Roll up invoice totals from per-line numbers (integer-exact)
@@ -281,6 +357,30 @@ export class BillingService {
       totalPaise      += computed.totalPaise;
     }
 
+    // 6b. PAN Rule 114B hard-block — now that total is known
+    enforcePanRequired({ totalPaise, pan: normalizedPan, form60Data: dto.form60Data ?? null });
+
+    // 6c. Encrypt PAN / Form 60 if provided (only reaches here when total >= Rs 2L or pan/form60 supplied)
+    let panCiphertext: Buffer | null = null;
+    let panKeyId: string | null = null;
+    let form60Encrypted: Buffer | null = null;
+    let form60KeyId: string | null = null;
+
+    if (normalizedPan != null || dto.form60Data != null) {
+      const keyArn = await this.getShopKekArn(ctx.shopId);
+      if (normalizedPan != null) {
+        const env = await encryptColumn(this.kms, keyArn, normalizedPan);
+        panCiphertext = serializeEnvelope(env);
+        panKeyId = keyArn;
+      }
+      if (dto.form60Data != null) {
+        const form60Json = JSON.stringify(dto.form60Data);
+        const env = await encryptColumn(this.kms, keyArn, form60Json);
+        form60Encrypted = serializeEnvelope(env);
+        form60KeyId = keyArn;
+      }
+    }
+
     // 7. Generate invoice number
     const invoiceNumber = generateInvoiceNumber(ctx.shopId);
 
@@ -301,7 +401,11 @@ export class BillingService {
         idempotencyKey,
         issuedAt:       new Date(),
         createdByUserId: ctx.userId,
-        items: lines.map(({ input, product, computed, ratePerGramPaise }, i) => ({
+        panCiphertext,
+        panKeyId,
+        form60Encrypted,
+        form60KeyId,
+        items: lines.map(({ input, product, computed, ratePerGramPaise, effectiveMakingPct }, i) => ({
           productId:           input.productId ?? null,
           description:         input.description,
           hsnCode:             '7113',
@@ -314,7 +418,7 @@ export class BillingService {
           purity:              product ? (product.purity ?? null)       : (input.purity ?? null),
           netWeightG:          product ? (product.net_weight_g ?? null) : (input.netWeightG ?? null),
           ratePerGramPaise,
-          makingChargePct:     input.makingChargePct,
+          makingChargePct:     effectiveMakingPct,
           goldValuePaise:      computed.goldValuePaise,
           makingChargePaise:   computed.makingChargePaise,
           stoneChargesPaise:   computed.stoneChargesPaise,
@@ -351,7 +455,7 @@ export class BillingService {
       throw err;
     }
 
-    // 9. Audit — phone masked; PAN never collected on B2C path
+    // 9. Audit — phone masked; PAN plaintext NEVER logged; only key_id for traceability
     const maskedPhone = maskPhone(dto.customerPhone ?? null);
     void auditLog(this.pool, {
       action: AuditAction.INVOICE_CREATED,
@@ -359,11 +463,14 @@ export class BillingService {
       subjectId: result.invoice.id,
       actorUserId: ctx.userId,
       after: {
-        invoice_number: result.invoice.invoice_number,
-        customer_name:  result.invoice.customer_name,
+        invoice_number:        result.invoice.invoice_number,
+        customer_name:         result.invoice.customer_name,
         customer_phone_masked: maskedPhone,
-        line_count:     result.items.length,
-        total_paise:    result.invoice.total_paise.toString(),
+        line_count:            result.items.length,
+        total_paise:           result.invoice.total_paise.toString(),
+        pan_captured:          panCiphertext !== null,
+        pan_key_id:            panKeyId ?? undefined,
+        form60_captured:       form60Encrypted !== null,
       },
     }).catch(() => undefined);
     void auditLog(this.pool, {
@@ -383,6 +490,44 @@ export class BillingService {
     return resp;
   }
 
+  async decryptInvoicePan(id: string): Promise<{ pan: string }> {
+    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;
+
+    // Rate-limit: 10 decryptions per shop per hour (Redis counter; best-effort)
+    const rateKey = PAN_DECRYPT_RATE_LIMIT_KEY(ctx.shopId);
+    try {
+      const count = await this.redis.incr(rateKey);
+      if (count === 1) {
+        await this.redis.expire(rateKey, 3600);
+      }
+      if (count > 10) {
+        throw new BadRequestException({ code: 'invoice.pan_decrypt_rate_limit_exceeded' });
+      }
+    } catch (e) {
+      if (e instanceof BadRequestException) throw e;
+      this.logger.warn(`Redis rate-limit check failed for PAN decrypt: ${String(e)}`);
+    }
+
+    const row = await this.repo.getInvoicePanData(id);
+    if (!row) throw new NotFoundException({ code: 'invoice.not_found' });
+    if (!row.pan_ciphertext || !row.pan_key_id) {
+      throw new NotFoundException({ code: 'invoice.pan_not_captured' });
+    }
+
+    const envelope = deserializeEnvelope(row.pan_ciphertext, row.pan_key_id);
+    const plaintext = await decryptColumn(this.kms, envelope);
+
+    void auditLog(this.pool, {
+      action: AuditAction.INVOICE_PAN_ACCESSED,
+      subjectType: 'invoice',
+      subjectId: id,
+      actorUserId: ctx.userId,
+      metadata: { pan_key_id: row.pan_key_id },
+    }).catch(() => undefined);
+
+    return { pan: plaintext };
+  }
+
   async getInvoice(id: string): Promise<InvoiceResponse> {
     const found = await this.repo.getInvoice(id);
     if (!found) throw new NotFoundException({ code: 'invoice.not_found' });

 succeeded in 227ms:
 apps/api/package.json                              |   1 +
 apps/api/src/modules/billing/billing.controller.ts |  13 +
 apps/api/src/modules/billing/billing.module.ts     |  13 +
 apps/api/src/modules/billing/billing.repository.ts |  32 +-
 .../src/modules/billing/billing.service.spec.ts    | 140 +++++++-
 apps/api/src/modules/billing/billing.service.ts    | 177 +++++++++-
 .../src/modules/inventory/inventory.repository.ts  |  25 ++
 .../api/src/modules/inventory/inventory.service.ts |  14 +-
 apps/api/test/billing.integration.test.ts          |   3 +
 apps/api/test/compliance-gates/pan-114b.test.ts    | 144 ++++++++
 apps/shopkeeper/app/billing/new.tsx                | 206 +++++++----
 .../features/billing/components/PanPromptSheet.tsx | 383 +++++++++++++++++++++
 packages/audit/src/audit-actions.ts                |   1 +
 packages/compliance/src/index.ts                   |   7 +
 packages/compliance/src/pan/rule-114b.test.ts      | 123 +++++++
 packages/compliance/src/pan/rule-114b.ts           |  38 ++
 .../compliance/src/pan/validate-format.test.ts     |  54 +++
 packages/compliance/src/pan/validate-format.ts     |  10 +
 .../crypto-envelope/src/envelope-codec.test.ts     |  49 +++
 packages/crypto-envelope/src/envelope-codec.ts     |  35 ++
 packages/crypto-envelope/src/index.ts              |   1 +
 packages/db/src/migrations/0023_invoice_pan.sql    |  10 +
 packages/db/src/schema/invoices.ts                 |  11 +-
 packages/shared/src/schemas/invoice.schema.ts      |  15 +-
 pnpm-lock.yaml                                     |   3 +
 25 files changed, 1400 insertions(+), 108 deletions(-)

 succeeded in 198ms:
apps/api/package.json
apps/api/src/modules/billing/billing.controller.ts
apps/api/src/modules/billing/billing.module.ts
apps/api/src/modules/billing/billing.repository.ts
apps/api/src/modules/billing/billing.service.spec.ts
apps/api/src/modules/billing/billing.service.ts
apps/api/src/modules/inventory/inventory.repository.ts
apps/api/src/modules/inventory/inventory.service.ts
apps/api/test/billing.integration.test.ts
apps/api/test/compliance-gates/pan-114b.test.ts
apps/shopkeeper/app/billing/new.tsx
apps/shopkeeper/src/features/billing/components/PanPromptSheet.tsx
packages/audit/src/audit-actions.ts
packages/compliance/src/index.ts
packages/compliance/src/pan/rule-114b.test.ts
packages/compliance/src/pan/rule-114b.ts
packages/compliance/src/pan/validate-format.test.ts
packages/compliance/src/pan/validate-format.ts
packages/crypto-envelope/src/envelope-codec.test.ts
packages/crypto-envelope/src/envelope-codec.ts
packages/crypto-envelope/src/index.ts
packages/db/src/migrations/0023_invoice_pan.sql
packages/db/src/schema/invoices.ts
packages/shared/src/schemas/invoice.schema.ts
pnpm-lock.yaml

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff 956e8d7742edf4bc7c8a6e78aade3d2600e1d5f2 -- apps/api/src/modules/inventory/inventory.repository.ts apps/api/src/modules/inventory/inventory.service.ts' in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff 956e8d7742edf4bc7c8a6e78aade3d2600e1d5f2 -- apps/shopkeeper/app/billing/new.tsx apps/shopkeeper/src/features/billing/components/PanPromptSheet.tsx' in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff 956e8d7742edf4bc7c8a6e78aade3d2600e1d5f2 -- apps/api/test/compliance-gates/pan-114b.test.ts apps/api/test/billing.integration.test.ts' in C:\Alok\Business Projects\Goldsmith
 succeeded in 186ms:
diff --git a/apps/api/src/modules/inventory/inventory.repository.ts b/apps/api/src/modules/inventory/inventory.repository.ts
index b9de4c7..39c214d 100644
--- a/apps/api/src/modules/inventory/inventory.repository.ts
+++ b/apps/api/src/modules/inventory/inventory.repository.ts
@@ -47,6 +47,17 @@ export interface FailedRow {
   error: string;
 }
 
+export interface ProductBillingRow {
+  id: string;
+  shop_id: string;
+  metal: string;
+  purity: string;
+  net_weight_g: string;
+  huid: string | null;
+  status: string;
+  category: string | null;
+}
+
 export interface ValuationProductRow {
   id: string;
   metal: string;
@@ -112,6 +123,20 @@ export class InventoryRepository {
     });
   }
 
+  async getProductBillingRow(id: string): Promise<ProductBillingRow | null> {
+    return withTenantTx(this.pool, async (tx) => {
+      const r = await tx.query<ProductBillingRow>(
+        `SELECT p.id, p.shop_id, p.metal, p.purity, p.net_weight_g, p.huid, p.status,
+                pc.name AS category
+           FROM products p
+           LEFT JOIN product_categories pc ON pc.id = p.category_id
+          WHERE p.id = $1`,
+        [id],
+      );
+      return r.rows[0] ?? null;
+    });
+  }
+
   async listProducts(filter: ListProductsFilter): Promise<ProductRow[]> {
     return withTenantTx(this.pool, async (tx) => {
       const conditions: string[] = [];
diff --git a/apps/api/src/modules/inventory/inventory.service.ts b/apps/api/src/modules/inventory/inventory.service.ts
index 0dbe606..5f0bdda 100644
--- a/apps/api/src/modules/inventory/inventory.service.ts
+++ b/apps/api/src/modules/inventory/inventory.service.ts
@@ -99,19 +99,11 @@ export class InventoryService {
    */
   async getProductRowForBilling(id: string): Promise<{
     id: string; shop_id: string; metal: string; purity: string;
-    net_weight_g: string; huid: string | null; status: string;
+    net_weight_g: string; huid: string | null; status: string; category: string | null;
   }> {
-    const row = await this.repo.getProduct(id);
+    const row = await this.repo.getProductBillingRow(id);
     if (!row) throw new NotFoundException({ code: 'inventory.product_not_found' });
-    return {
-      id:           row.id,
-      shop_id:      row.shop_id,
-      metal:        row.metal,
-      purity:       row.purity,
-      net_weight_g: row.net_weight_g,
-      huid:         row.huid,
-      status:       row.status,
-    };
+    return row;
   }
 
   async updateProduct(id: string, dto: UpdateProductDto): Promise<ProductResponse> {

 succeeded in 182ms:
diff --git a/apps/shopkeeper/app/billing/new.tsx b/apps/shopkeeper/app/billing/new.tsx
index 1ce23f6..71c3c8c 100644
--- a/apps/shopkeeper/app/billing/new.tsx
+++ b/apps/shopkeeper/app/billing/new.tsx
@@ -15,19 +15,36 @@ import { BillingLineBuilder } from '@goldsmith/ui-mobile';
 import type { BillingLineValue, BillingLineProduct } from '@goldsmith/ui-mobile';
 import { api } from '../../src/api/client';
 import type { InvoiceResponse, CreateInvoiceDtoType } from '@goldsmith/shared';
+import { PanPromptSheet } from '../../src/features/billing/components/PanPromptSheet';
+import type { PanSubmitPayload } from '../../src/features/billing/components/PanPromptSheet';
 
 interface DraftLine extends BillingLineValue {
   product: BillingLineProduct;
   ratePerGramPaise: bigint;
 }
 
+function extractTotalPaise(errorBody: unknown): bigint {
+  try {
+    const body = errorBody as { totalPaise?: string } | null | undefined;
+    const raw = body?.totalPaise;
+    if (raw != null) return BigInt(raw);
+  } catch {
+    // fall through
+  }
+  return 0n;
+}
+
 export default function NewInvoiceScreen(): JSX.Element {
   const [customerName, setCustomerName] = useState<string>('');
   const [customerPhone, setCustomerPhone] = useState<string>('');
   const [lines, setLines] = useState<DraftLine[]>([]);
   const [idempotencyKey] = useState<string>(() => uuid());
 
-  const createInvoice = useMutation<InvoiceResponse, Error, CreateInvoiceDtoType>({
+  // PAN prompt state
+  const [panRequired, setPanRequired] = useState(false);
+  const [panTotalPaise, setPanTotalPaise] = useState(0n);
+
+  const createInvoice = useMutation<InvoiceResponse, unknown, CreateInvoiceDtoType>({
     mutationFn: async (dto) => {
       const res = await api.post<InvoiceResponse>('/api/v1/billing/invoices', dto, {
         headers: { 'Idempotency-Key': idempotencyKey },
@@ -37,10 +54,41 @@ export default function NewInvoiceScreen(): JSX.Element {
     // eslint-disable-next-line @typescript-eslint/no-explicit-any
     onSuccess: (invoice) => router.replace(`/billing/${invoice.id}` as any),
     onError: (err) => {
-      Alert.alert('Invoice generate नहीं हुआ', err.message);
+      const body = (err as { response?: { data?: unknown; status?: number } }).response?.data;
+      const status = (err as { response?: { status?: number } }).response?.status;
+      const code = (body as { code?: string } | null | undefined)?.code;
+
+      if (status === 422 && code === 'compliance.pan_required') {
+        const totalPaise = extractTotalPaise(body);
+        setPanTotalPaise(totalPaise);
+        setPanRequired(true);
+        return;
+      }
+
+      const message = (body as { detail?: string } | null | undefined)?.detail
+        ?? (err instanceof Error ? err.message : 'कुछ गलत हो गया');
+      Alert.alert('Invoice generate नहीं हुआ', message);
     },
   });
 
+  const buildDto = useCallback(
+    (extra: PanSubmitPayload = {}): CreateInvoiceDtoType => ({
+      customerName: customerName.trim(),
+      ...(customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {}),
+      lines: lines.map((l) => ({
+        productId: l.productId,
+        description: l.description,
+        huid: l.huid,
+        makingChargePct: l.makingChargePct,
+        stoneChargesPaise: '0',
+        hallmarkFeePaise: '0',
+      })),
+      ...(extra.pan ? { pan: extra.pan } : {}),
+      ...(extra.form60Data ? { form60Data: extra.form60Data } : {}),
+    }),
+    [customerName, customerPhone, lines],
+  );
+
   const onLineChange = useCallback((index: number, next: BillingLineValue) => {
     setLines((curr) => {
       const copy = [...curr];
@@ -58,80 +106,90 @@ export default function NewInvoiceScreen(): JSX.Element {
       Alert.alert('कम से कम एक आइटम जोड़ें');
       return;
     }
-    const dto: CreateInvoiceDtoType = {
-      customerName: customerName.trim(),
-      ...(customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {}),
-      lines: lines.map((l) => ({
-        productId: l.productId,
-        description: l.description,
-        huid: l.huid,
-        makingChargePct: l.makingChargePct,
-        stoneChargesPaise: '0',
-        hallmarkFeePaise: '0',
-      })),
-    };
-    createInvoice.mutate(dto);
-  }, [customerName, customerPhone, lines, createInvoice]);
+    createInvoice.mutate(buildDto());
+  }, [customerName, lines, buildDto, createInvoice]);
+
+  const onPanSubmit = useCallback(
+    (payload: PanSubmitPayload) => {
+      setPanRequired(false);
+      createInvoice.mutate(buildDto(payload));
+    },
+    [buildDto, createInvoice],
+  );
+
+  const onPanCancel = useCallback(() => {
+    setPanRequired(false);
+    setPendingDto(null);
+  }, []);
 
   return (
-    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
-      <Text style={styles.title}>नया Invoice</Text>
-
-      <View style={styles.card}>
-        <Text style={styles.label}>ग्राहक का नाम *</Text>
-        <TextInput
-          value={customerName}
-          onChangeText={setCustomerName}
-          style={styles.input}
-          placeholder="नाम लिखें"
-          accessibilityLabel="Customer name"
-        />
-        <Text style={styles.label}>फ़ोन (वैकल्पिक)</Text>
-        <TextInput
-          value={customerPhone}
-          onChangeText={setCustomerPhone}
-          keyboardType="phone-pad"
-          maxLength={10}
-          style={styles.input}
-          placeholder="9876543210"
-          accessibilityLabel="Customer phone"
-        />
-      </View>
-
-      {lines.map((line, i) => (
-        <BillingLineBuilder
-          key={`${line.productId}-${i}`}
-          product={line.product}
-          ratePerGramPaise={line.ratePerGramPaise}
-          makingChargePct={line.makingChargePct}
-          onChange={(v) => onLineChange(i, v)}
-        />
-      ))}
-
-      <Pressable
-        // eslint-disable-next-line @typescript-eslint/no-explicit-any
-        onPress={() => router.push('/billing/scan' as any)}
-        style={styles.scanButton}
-        accessibilityRole="button"
-      >
-        <Text style={styles.scanButtonText}>+ बारकोड स्कैन करें</Text>
-      </Pressable>
-
-      <Pressable
-        onPress={onSubmit}
-        disabled={createInvoice.isPending}
-        style={[
-          styles.submitButton,
-          createInvoice.isPending && styles.submitButtonDisabled,
-        ]}
-        accessibilityRole="button"
-        accessibilityState={{ disabled: createInvoice.isPending }}
-      >
-        <Text style={styles.submitButtonText}>
-          {createInvoice.isPending ? 'Generate हो रहा है...' : 'Invoice बनाएं'}
-        </Text>
-      </Pressable>
-    </ScrollView>
+    <>
+      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
+        <Text style={styles.title}>नया Invoice</Text>
+
+        <View style={styles.card}>
+          <Text style={styles.label}>ग्राहक का नाम *</Text>
+          <TextInput
+            value={customerName}
+            onChangeText={setCustomerName}
+            style={styles.input}
+            placeholder="नाम लिखें"
+            accessibilityLabel="Customer name"
+          />
+          <Text style={styles.label}>फ़ोन (वैकल्पिक)</Text>
+          <TextInput
+            value={customerPhone}
+            onChangeText={setCustomerPhone}
+            keyboardType="phone-pad"
+            maxLength={10}
+            style={styles.input}
+            placeholder="9876543210"
+            accessibilityLabel="Customer phone"
+          />
+        </View>
+
+        {lines.map((line, i) => (
+          <BillingLineBuilder
+            key={`${line.productId}-${i}`}
+            product={line.product}
+            ratePerGramPaise={line.ratePerGramPaise}
+            makingChargePct={line.makingChargePct}
+            onChange={(v) => onLineChange(i, v)}
+          />
+        ))}
+
+        <Pressable
+          // eslint-disable-next-line @typescript-eslint/no-explicit-any
+          onPress={() => router.push('/billing/scan' as any)}
+          style={styles.scanButton}
+          accessibilityRole="button"
+        >
+          <Text style={styles.scanButtonText}>+ बारकोड स्कैन करें</Text>
+        </Pressable>
+
+        <Pressable
+          onPress={onSubmit}
+          disabled={createInvoice.isPending}
+          style={[
+            styles.submitButton,
+            createInvoice.isPending && styles.submitButtonDisabled,
+          ]}
+          accessibilityRole="button"
+          accessibilityState={{ disabled: createInvoice.isPending }}
+        >
+          <Text style={styles.submitButtonText}>
+            {createInvoice.isPending ? 'Generate हो रहा है...' : 'Invoice बनाएं'}
+          </Text>
+        </Pressable>
+      </ScrollView>
+
+      <PanPromptSheet
+        visible={panRequired}
+        totalPaise={panTotalPaise}
+        onSubmit={onPanSubmit}
+        onCancel={onPanCancel}
+      />
+    </>
   );
 }
 
diff --git a/apps/shopkeeper/src/features/billing/components/PanPromptSheet.tsx b/apps/shopkeeper/src/features/billing/components/PanPromptSheet.tsx
new file mode 100644
index 0000000..bc54566
--- /dev/null
+++ b/apps/shopkeeper/src/features/billing/components/PanPromptSheet.tsx
@@ -0,0 +1,383 @@
+import React, { useState, useRef, useEffect, useCallback } from 'react';
+import {
+  View,
+  Text,
+  TextInput,
+  Pressable,
+  Modal,
+  Animated,
+  ScrollView,
+  StyleSheet,
+  AccessibilityInfo,
+} from 'react-native';
+
+// PAN format: 5 uppercase alpha + 4 digits + 1 uppercase alpha
+const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
+
+export interface Form60Data {
+  name: string;
+  address: string;
+  reasonForNoPan: string;
+  estimatedAnnualIncomePaise: string;
+}
+
+export interface PanSubmitPayload {
+  pan?: string;
+  form60Data?: Form60Data;
+}
+
+interface Props {
+  visible: boolean;
+  totalPaise: bigint;
+  onSubmit: (payload: PanSubmitPayload) => void;
+  onCancel: () => void;
+}
+
+function formatRupees(paise: bigint): string {
+  const rupees = Number(paise) / 100;
+  return `₹${rupees.toLocaleString('hi-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
+}
+
+type Tab = 'pan' | 'form60';
+
+export function PanPromptSheet({ visible, totalPaise, onSubmit, onCancel }: Props): JSX.Element {
+  const slideAnim = useRef(new Animated.Value(400)).current;
+  const [tab, setTab] = useState<Tab>('pan');
+  const [pan, setPan] = useState('');
+  const [panError, setPanError] = useState<string | null>(null);
+  const [f60Name, setF60Name] = useState('');
+  const [f60Address, setF60Address] = useState('');
+  const [f60Reason, setF60Reason] = useState('');
+  const [f60Income, setF60Income] = useState('');
+
+  useEffect(() => {
+    if (visible) {
+      Animated.spring(slideAnim, {
+        toValue: 0,
+        useNativeDriver: true,
+        bounciness: 0,
+      }).start();
+    } else {
+      slideAnim.setValue(400);
+      setPan('');
+      setPanError(null);
+      setTab('pan');
+      setF60Name('');
+      setF60Address('');
+      setF60Reason('');
+      setF60Income('');
+    }
+  }, [visible, slideAnim]);
+
+  const handlePanChange = useCallback((text: string) => {
+    const normalized = text.toUpperCase().replace(/\s+/g, '');
+    setPan(normalized);
+    if (normalized.length === 10) {
+      setPanError(PAN_RE.test(normalized) ? null : 'PAN format सही नहीं — जैसे: ABCDE1234F');
+    } else {
+      setPanError(null);
+    }
+  }, []);
+
+  const handleSubmitPan = useCallback(() => {
+    const normalized = pan.toUpperCase().trim();
+    if (!PAN_RE.test(normalized)) {
+      setPanError('PAN format सही नहीं — जैसे: ABCDE1234F');
+      AccessibilityInfo.announceForAccessibility('PAN format सही नहीं');
+      return;
+    }
+    onSubmit({ pan: normalized });
+  }, [pan, onSubmit]);
+
+  const handleSubmitForm60 = useCallback(() => {
+    if (!f60Name.trim() || !f60Address.trim() || !f60Reason.trim() || !f60Income.trim()) {
+      AccessibilityInfo.announceForAccessibility('सभी फ़ील्ड ज़रूरी हैं');
+      return;
+    }
+    const incomePaise = f60Income.replace(/[^0-9]/g, '');
+    onSubmit({
+      form60Data: {
+        name: f60Name.trim(),
+        address: f60Address.trim(),
+        reasonForNoPan: f60Reason.trim(),
+        estimatedAnnualIncomePaise: incomePaise || '0',
+      },
+    });
+  }, [f60Name, f60Address, f60Reason, f60Income, onSubmit]);
+
+  return (
+    <Modal
+      visible={visible}
+      transparent
+      animationType="none"
+      onRequestClose={onCancel}
+      accessibilityViewIsModal
+    >
+      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="रद्द करें" />
+      <Animated.View
+        style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
+        accessibilityRole="dialog"
+        accessibilityLabel="PAN या Form 60 ज़रूरी है"
+      >
+        <View style={styles.handle} />
+
+        <Text style={styles.heading}>PAN या Form 60 ज़रूरी है</Text>
+        <Text style={styles.totalLine}>
+          कुल बिल: <Text style={styles.totalAmount}>{formatRupees(totalPaise)}</Text>
+        </Text>
+        <Text style={styles.subtext}>
+          ₹2,00,000 से अधिक के bill पर PAN या Form 60 आवश्यक है (Rule 114B)।
+        </Text>
+
+        {/* Tab selector */}
+        <View style={styles.tabRow} accessibilityRole="tablist">
+          <Pressable
+            style={[styles.tabBtn, tab === 'pan' && styles.tabBtnActive]}
+            onPress={() => setTab('pan')}
+            accessibilityRole="tab"
+            accessibilityState={{ selected: tab === 'pan' }}
+          >
+            <Text style={[styles.tabText, tab === 'pan' && styles.tabTextActive]}>
+              PAN दर्ज करें
+            </Text>
+          </Pressable>
+          <Pressable
+            style={[styles.tabBtn, tab === 'form60' && styles.tabBtnActive]}
+            onPress={() => setTab('form60')}
+            accessibilityRole="tab"
+            accessibilityState={{ selected: tab === 'form60' }}
+          >
+            <Text style={[styles.tabText, tab === 'form60' && styles.tabTextActive]}>
+              Form 60 भरें
+            </Text>
+          </Pressable>
+        </View>
+
+        <ScrollView style={styles.tabContent} keyboardShouldPersistTaps="handled">
+          {tab === 'pan' ? (
+            <View>
+              <Text style={styles.fieldLabel}>PAN नंबर</Text>
+              <TextInput
+                value={pan}
+                onChangeText={handlePanChange}
+                style={[styles.input, panError ? styles.inputError : null]}
+                placeholder="ABCDE1234F"
+                autoCapitalize="characters"
+                maxLength={10}
+                keyboardType="default"
+                accessibilityLabel="PAN नंबर"
+                accessibilityHint="10 अक्षर — 5 अक्षर, 4 अंक, 1 अक्षर"
+              />
+              {panError ? (
+                <Text style={styles.errorText} accessibilityRole="alert">
+                  {panError}
+                </Text>
+              ) : null}
+
+              <Pressable
+                onPress={handleSubmitPan}
+                style={styles.submitBtn}
+                accessibilityRole="button"
+              >
+                <Text style={styles.submitBtnText}>PAN ज़मा करें</Text>
+              </Pressable>
+            </View>
+          ) : (
+            <View>
+              <Text style={styles.fieldLabel}>नाम *</Text>
+              <TextInput
+                value={f60Name}
+                onChangeText={setF60Name}
+                style={styles.input}
+                placeholder="ग्राहक का पूरा नाम"
+                accessibilityLabel="ग्राहक का नाम"
+              />
+
+              <Text style={styles.fieldLabel}>पता *</Text>
+              <TextInput
+                value={f60Address}
+                onChangeText={setF60Address}
+                style={[styles.input, styles.inputMultiline]}
+                placeholder="पूरा पता"
+                multiline
+                numberOfLines={3}
+                accessibilityLabel="पूरा पता"
+              />
+
+              <Text style={styles.fieldLabel}>PAN न होने का कारण *</Text>
+              <TextInput
+                value={f60Reason}
+                onChangeText={setF60Reason}
+                style={styles.input}
+                placeholder="जैसे: PAN card नहीं बना है"
+                accessibilityLabel="PAN न होने का कारण"
+              />
+
+              <Text style={styles.fieldLabel}>अनुमानित वार्षिक आय (₹) *</Text>
+              <TextInput
+                value={f60Income}
+                onChangeText={setF60Income}
+                style={styles.input}
+                placeholder="0"
+                keyboardType="numeric"
+                accessibilityLabel="अनुमानित वार्षिक आय रुपये में"
+              />
+
+              <Pressable
+                onPress={handleSubmitForm60}
+                style={styles.submitBtn}
+                accessibilityRole="button"
+              >
+                <Text style={styles.submitBtnText}>Form 60 ज़मा करें</Text>
+              </Pressable>
+            </View>
+          )}
+        </ScrollView>
+
+        <Pressable onPress={onCancel} style={styles.cancelBtn} accessibilityRole="button">
+          <Text style={styles.cancelText}>रद्द करें</Text>
+        </Pressable>
+      </Animated.View>
+    </Modal>
+  );
+}
+
+const styles = StyleSheet.create({
+  backdrop: {
+    ...StyleSheet.absoluteFillObject,
+    backgroundColor: 'rgba(0,0,0,0.45)',
+  },
+  sheet: {
+    position: 'absolute',
+    bottom: 0,
+    left: 0,
+    right: 0,
+    backgroundColor: '#fdf6ec',
+    borderTopLeftRadius: 20,
+    borderTopRightRadius: 20,
+    paddingHorizontal: 20,
+    paddingBottom: 32,
+    maxHeight: '90%',
+  },
+  handle: {
+    width: 40,
+    height: 4,
+    backgroundColor: '#d6d3d1',
+    borderRadius: 2,
+    alignSelf: 'center',
+    marginTop: 10,
+    marginBottom: 16,
+  },
+  heading: {
+    fontSize: 20,
+    fontWeight: '700',
+    fontFamily: 'NotoSansDevanagari',
+    color: '#1c1917',
+    marginBottom: 6,
+  },
+  totalLine: {
+    fontSize: 16,
+    fontFamily: 'NotoSansDevanagari',
+    color: '#44403c',
+    marginBottom: 4,
+  },
+  totalAmount: {
+    fontWeight: '700',
+    color: '#92400e',
+    fontSize: 18,
+  },
+  subtext: {
+    fontSize: 13,
+    fontFamily: 'NotoSansDevanagari',
+    color: '#78716c',
+    marginBottom: 16,
+    lineHeight: 18,
+  },
+  tabRow: {
+    flexDirection: 'row',
+    borderRadius: 8,
+    borderWidth: 1,
+    borderColor: '#e7e5e4',
+    marginBottom: 16,
+    overflow: 'hidden',
+  },
+  tabBtn: {
+    flex: 1,
+    paddingVertical: 12,
+    alignItems: 'center',
+    backgroundColor: '#ffffff',
+    minHeight: 48,
+  },
+  tabBtnActive: {
+    backgroundColor: '#92400e',
+  },
+  tabText: {
+    fontSize: 14,
+    fontFamily: 'NotoSansDevanagari',
+    color: '#78716c',
+  },
+  tabTextActive: {
+    color: '#ffffff',
+    fontWeight: '600',
+  },
+  tabContent: {
+    flexGrow: 0,
+  },
+  fieldLabel: {
+    fontSize: 14,
+    fontFamily: 'NotoSansDevanagari',
+    color: '#44403c',
+    marginBottom: 4,
+  },
+  input: {
+    borderWidth: 1,
+    borderColor: '#d6d3d1',
+    borderRadius: 8,
+    paddingHorizontal: 12,
+    paddingVertical: 12,
+    fontSize: 16,
+    marginBottom: 12,
+    backgroundColor: '#ffffff',
+    minHeight: 48,
+    color: '#1c1917',
+  },
+  inputError: {
+    borderColor: '#dc2626',
+  },
+  inputMultiline: {
+    minHeight: 80,
+    textAlignVertical: 'top',
+  },
+  errorText: {
+    color: '#dc2626',
+    fontSize: 13,
+    fontFamily: 'NotoSansDevanagari',
+    marginTop: -8,
+    marginBottom: 10,
+  },
+  submitBtn: {
+    backgroundColor: '#92400e',
+    borderRadius: 10,
+    paddingVertical: 16,
+    alignItems: 'center',
+    marginTop: 4,
+    marginBottom: 12,
+    minHeight: 48,
+  },
+  submitBtnText: {
+    color: '#ffffff',
+    fontSize: 16,
+    fontWeight: '700',
+    fontFamily: 'NotoSansDevanagari',
+  },
+  cancelBtn: {
+    paddingVertical: 14,
+    alignItems: 'center',
+    minHeight: 48,
+  },
+  cancelText: {
+    color: '#78716c',
+    fontSize: 16,
+    fontFamily: 'NotoSansDevanagari',
+  },
+});

 succeeded in 197ms:
diff --git a/apps/api/test/billing.integration.test.ts b/apps/api/test/billing.integration.test.ts
index cd2b931..f7a51cd 100644
--- a/apps/api/test/billing.integration.test.ts
+++ b/apps/api/test/billing.integration.test.ts
@@ -125,6 +125,9 @@ function buildBillingService(): BillingService {
     pricingSvc,
     redis as never,      // BILLING_REDIS
     pool as never,       // PG_POOL
+    undefined as never,  // KMS_ADAPTER — not used in these tests
+    undefined as never,  // SettingsCache — all tests pass makingChargePct explicitly
+    undefined as never,  // SettingsRepository — see above
   );
 }
 
diff --git a/apps/api/test/compliance-gates/pan-114b.test.ts b/apps/api/test/compliance-gates/pan-114b.test.ts
new file mode 100644
index 0000000..3dd454a
--- /dev/null
+++ b/apps/api/test/compliance-gates/pan-114b.test.ts
@@ -0,0 +1,144 @@
+import { describe, expect, it } from 'vitest';
+import { readFileSync } from 'node:fs';
+import { resolve } from 'node:path';
+import { enforcePanRequired, ComplianceHardBlockError, PAN_THRESHOLD_PAISE } from '@goldsmith/compliance';
+import { encryptColumn, decryptColumn, serializeEnvelope, deserializeEnvelope, LocalKMS } from '@goldsmith/crypto-envelope';
+
+/**
+ * PAN Rule 114B compliance gate.
+ * Static-analysis block: verifies billing service source never removes the gate.
+ * Unit block: threshold boundary, encryption round-trip, tenant isolation.
+ */
+describe('PAN Rule 114B — billing service static checks', () => {
+  const svcSrc = readFileSync(
+    resolve(__dirname, '../../src/modules/billing/billing.service.ts'),
+    'utf8',
+  );
+
+  it('imports enforcePanRequired from @goldsmith/compliance', () => {
+    expect(svcSrc).toMatch(
+      /import\s*\{[^}]*enforcePanRequired[^}]*\}\s*from\s*['"]@goldsmith\/compliance['"]/,
+    );
+  });
+
+  it('calls enforcePanRequired before insertInvoice (hard-block fires before DB write)', () => {
+    const idxEnforce = svcSrc.indexOf('enforcePanRequired(');
+    const idxInsert  = svcSrc.indexOf('this.repo.insertInvoice(');
+    expect(idxEnforce).toBeGreaterThan(-1);
+    expect(idxInsert).toBeGreaterThan(-1);
+    expect(idxEnforce).toBeLessThan(idxInsert);
+  });
+
+  it('imports encryptColumn from @goldsmith/crypto-envelope (PAN encrypted at app layer)', () => {
+    expect(svcSrc).toMatch(
+      /import\s*\{[^}]*encryptColumn[^}]*\}\s*from\s*['"]@goldsmith\/crypto-envelope['"]/,
+    );
+  });
+
+  it('does NOT log PAN plaintext in audit (no bare `pan: normalizedPan`)', () => {
+    const auditAfterBlocks = [...svcSrc.matchAll(/after:\s*\{[^}]+\}/gs)].map((m) => m[0]);
+    for (const block of auditAfterBlocks) {
+      expect(block).not.toMatch(/\bpan:\s*normalized/);
+      expect(block).not.toMatch(/\bpan:\s*dto\.pan/);
+    }
+  });
+
+  it('does NOT include pan_ciphertext inside any audit `after:` object literal', () => {
+    // Extract each `after: { ... }` block (single-line) and verify none contain pan_ciphertext.
+    const auditAfterBlocks = [...svcSrc.matchAll(/after:\s*\{[^}]+\}/g)].map((m) => m[0]);
+    for (const block of auditAfterBlocks) {
+      expect(block).not.toMatch(/pan_ciphertext/i);
+    }
+  });
+
+  it('normalizes PAN before encryption (normalizePan called)', () => {
+    expect(svcSrc).toMatch(/normalizePan\(/);
+  });
+
+  it('validates PAN format before encryption (validatePanFormat called)', () => {
+    expect(svcSrc).toMatch(/validatePanFormat\(/);
+  });
+
+  it('uses per-tenant KEK from shops table (getShopKekArn called)', () => {
+    expect(svcSrc).toMatch(/getShopKekArn\(/);
+  });
+
+  it('encrypts Form60 data before DB write (serializeEnvelope used)', () => {
+    const idxForm60Encrypt = svcSrc.indexOf('form60Encrypted = serializeEnvelope');
+    const idxInsert        = svcSrc.indexOf('this.repo.insertInvoice(');
+    expect(idxForm60Encrypt).toBeGreaterThan(-1);
+    expect(idxForm60Encrypt).toBeLessThan(idxInsert);
+  });
+});
+
+describe('PAN Rule 114B — threshold boundary', () => {
+  it('PAN_THRESHOLD_PAISE is exactly Rs 2,00,000 in paise (20_000_000n)', () => {
+    expect(PAN_THRESHOLD_PAISE).toBe(20_000_000n);
+  });
+
+  it('Rs 1,99,999 (19_999_900n paise) — no block without PAN', () => {
+    expect(() =>
+      enforcePanRequired({ totalPaise: 19_999_900n, pan: null, form60Data: null }),
+    ).not.toThrow();
+  });
+
+  it('Rs 2,00,000 (20_000_000n paise) — blocks without PAN', () => {
+    expect(() =>
+      enforcePanRequired({ totalPaise: 20_000_000n, pan: null, form60Data: null }),
+    ).toThrow(ComplianceHardBlockError);
+  });
+
+  it('Rs 2,00,001 (20_000_100n paise) — blocks without PAN', () => {
+    expect(() =>
+      enforcePanRequired({ totalPaise: 20_000_100n, pan: null, form60Data: null }),
+    ).toThrow(ComplianceHardBlockError);
+  });
+
+  it('Rs 2,00,001 — passes with valid PAN', () => {
+    expect(() =>
+      enforcePanRequired({ totalPaise: 20_000_100n, pan: 'ABCDE1234F', form60Data: null }),
+    ).not.toThrow();
+  });
+
+  it('Rs 2,00,001 — passes with Form60', () => {
+    expect(() =>
+      enforcePanRequired({
+        totalPaise:  20_000_100n,
+        pan:         null,
+        form60Data:  { name: 'Ram', address: 'Ayodhya UP', reasonForNoPan: 'no card', estimatedAnnualIncomePaise: '0' },
+      }),
+    ).not.toThrow();
+  });
+});
+
+describe('PAN Rule 114B — encryption round-trip + tenant isolation', () => {
+  it('PAN encrypt → serialize → deserialize → decrypt returns original', async () => {
+    const kms    = new LocalKMS();
+    const keyArn = await kms.createKeyForTenant('shop-test');
+    const pan    = 'ABCDE1234F';
+    const env    = await encryptColumn(kms, keyArn, pan);
+    const buf    = serializeEnvelope(env);
+    const deser  = deserializeEnvelope(buf, keyArn);
+    const plain  = await decryptColumn(kms, deser);
+    expect(plain).toBe(pan);
+  });
+
+  it('PAN never appears in serialized bytes as plaintext UTF-8', async () => {
+    const kms    = new LocalKMS();
+    const keyArn = await kms.createKeyForTenant('shop-test-2');
+    const pan    = 'ABCDE1234F';
+    const env    = await encryptColumn(kms, keyArn, pan);
+    const buf    = serializeEnvelope(env);
+    expect(buf.toString('utf8')).not.toContain(pan);
+  });
+
+  it('Tenant A key cannot decrypt Tenant B ciphertext (per-tenant isolation)', async () => {
+    const kms  = new LocalKMS();
+    const arnA = await kms.createKeyForTenant('tenant-a');
+    const arnB = await kms.createKeyForTenant('tenant-b');
+    const env  = await encryptColumn(kms, arnA, 'ABCDE1234F');
+    const buf  = serializeEnvelope(env);
+    const wrongDeser = deserializeEnvelope(buf, arnB);
+    await expect(decryptColumn(kms, wrongDeser)).rejects.toThrow();
+  });
+});

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Path 'apps/shopkeeper/app/billing/new.tsx'" in C:\Alok\Business Projects\Goldsmith
 succeeded in 215ms:
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { v4 as uuid } from 'uuid';
import { BillingLineBuilder } from '@goldsmith/ui-mobile';
import type { BillingLineValue, BillingLineProduct } from '@goldsmith/ui-mobile';
import { api } from '../../src/api/client';
import type { InvoiceResponse, CreateInvoiceDtoType } from '@goldsmith/shared';
import { PanPromptSheet } from '../../src/features/billing/components/PanPromptSheet';
import type { PanSubmitPayload } from '../../src/features/billing/components/PanPromptSheet';

interface DraftLine extends BillingLineValue {
  product: BillingLineProduct;
  ratePerGramPaise: bigint;
}

function extractTotalPaise(errorBody: unknown): bigint {
  try {
    const body = errorBody as { totalPaise?: string } | null | undefined;
    const raw = body?.totalPaise;
    if (raw != null) return BigInt(raw);
  } catch {
    // fall through
  }
  return 0n;
}

export default function NewInvoiceScreen(): JSX.Element {
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [idempotencyKey] = useState<string>(() => uuid());

  // PAN prompt state
  const [panRequired, setPanRequired] = useState(false);
  const [panTotalPaise, setPanTotalPaise] = useState(0n);

  const createInvoice = useMutation<InvoiceResponse, unknown, CreateInvoiceDtoType>({
    mutationFn: async (dto) => {
      const res = await api.post<InvoiceResponse>('/api/v1/billing/invoices', dto, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
      return res.data;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (invoice) => router.replace(`/billing/${invoice.id}` as any),
    onError: (err) => {
      const body = (err as { response?: { data?: unknown; status?: number } }).response?.data;
      const status = (err as { response?: { status?: number } }).response?.status;
      const code = (body as { code?: string } | null | undefined)?.code;

      if (status === 422 && code === 'compliance.pan_required') {
        const totalPaise = extractTotalPaise(body);
        setPanTotalPaise(totalPaise);
        setPanRequired(true);
        return;
      }

      const message = (body as { detail?: string } | null | undefined)?.detail
        ?? (err instanceof Error ? err.message : 'à¤•à¥à¤› à¤—à¤²à¤¤ à¤¹à¥‹ à¤—à¤¯à¤¾');
      Alert.alert('Invoice generate à¤¨à¤¹à¥€à¤‚ à¤¹à¥à¤†', message);
    },
  });

  const buildDto = useCallback(
    (extra: PanSubmitPayload = {}): CreateInvoiceDtoType => ({
      customerName: customerName.trim(),
      ...(customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {}),
      lines: lines.map((l) => ({
        productId: l.productId,
        description: l.description,
        huid: l.huid,
        makingChargePct: l.makingChargePct,
        stoneChargesPaise: '0',
        hallmarkFeePaise: '0',
      })),
      ...(extra.pan ? { pan: extra.pan } : {}),
      ...(extra.form60Data ? { form60Data: extra.form60Data } : {}),
    }),
    [customerName, customerPhone, lines],
  );

  const onLineChange = useCallback((index: number, next: BillingLineValue) => {
    setLines((curr) => {
      const copy = [...curr];
      copy[index] = { ...copy[index]!, ...next };
      return copy;
    });
  }, []);

  const onSubmit = useCallback(() => {
    if (!customerName.trim()) {
      Alert.alert('à¤—à¥à¤°à¤¾à¤¹à¤• à¤•à¤¾ à¤¨à¤¾à¤® à¤†à¤µà¤¶à¥à¤¯à¤• à¤¹à¥ˆ');
      return;
    }
    if (lines.length === 0) {
      Alert.alert('à¤•à¤® à¤¸à¥‡ à¤•à¤® à¤à¤• à¤†à¤‡à¤Ÿà¤® à¤œà¥‹à¤¡à¤¼à¥‡à¤‚');
      return;
    }
    createInvoice.mutate(buildDto());
  }, [customerName, lines, buildDto, createInvoice]);

  const onPanSubmit = useCallback(
    (payload: PanSubmitPayload) => {
      setPanRequired(false);
      createInvoice.mutate(buildDto(payload));
    },
    [buildDto, createInvoice],
  );

  const onPanCancel = useCallback(() => {
    setPanRequired(false);
    setPendingDto(null);
  }, []);

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>à¤¨à¤¯à¤¾ Invoice</Text>

        <View style={styles.card}>
          <Text style={styles.label}>à¤—à¥à¤°à¤¾à¤¹à¤• à¤•à¤¾ à¤¨à¤¾à¤® *</Text>
          <TextInput
            value={customerName}
            onChangeText={setCustomerName}
            style={styles.input}
            placeholder="à¤¨à¤¾à¤® à¤²à¤¿à¤–à¥‡à¤‚"
            accessibilityLabel="Customer name"
          />
          <Text style={styles.label}>à¤«à¤¼à¥‹à¤¨ (à¤µà¥ˆà¤•à¤²à¥à¤ªà¤¿à¤•)</Text>
          <TextInput
            value={customerPhone}
            onChangeText={setCustomerPhone}
            keyboardType="phone-pad"
            maxLength={10}
            style={styles.input}
            placeholder="9876543210"
            accessibilityLabel="Customer phone"
          />
        </View>

        {lines.map((line, i) => (
          <BillingLineBuilder
            key={`${line.productId}-${i}`}
            product={line.product}
            ratePerGramPaise={line.ratePerGramPaise}
            makingChargePct={line.makingChargePct}
            onChange={(v) => onLineChange(i, v)}
          />
        ))}

        <Pressable
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onPress={() => router.push('/billing/scan' as any)}
          style={styles.scanButton}
          accessibilityRole="button"
        >
          <Text style={styles.scanButtonText}>+ à¤¬à¤¾à¤°à¤•à¥‹à¤¡ à¤¸à¥à¤•à¥ˆà¤¨ à¤•à¤°à¥‡à¤‚</Text>
        </Pressable>

        <Pressable
          onPress={onSubmit}
          disabled={createInvoice.isPending}
          style={[
            styles.submitButton,
            createInvoice.isPending && styles.submitButtonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: createInvoice.isPending }}
        >
          <Text style={styles.submitButtonText}>
            {createInvoice.isPending ? 'Generate à¤¹à¥‹ à¤°à¤¹à¤¾ à¤¹à¥ˆ...' : 'Invoice à¤¬à¤¨à¤¾à¤à¤‚'}
          </Text>
        </Pressable>
      </ScrollView>

      <PanPromptSheet
        visible={panRequired}
        totalPaise={panTotalPaise}
        onSubmit={onPanSubmit}
        onCancel={onPanCancel}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  content: { padding: 16 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    fontFamily: 'NotoSansDevanagari',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  label: {
    fontSize: 14,
    marginBottom: 4,
    fontFamily: 'NotoSansDevanagari',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d6d3d1',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
    minHeight: 48,
  },
  scanButton: {
    backgroundColor: '#e7e5e4',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    minHeight: 48,
  },
  scanButtonText: {
    fontSize: 16,
    fontFamily: 'NotoSansDevanagari',
  },
  submitButton: {
    backgroundColor: '#92400e',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 48,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'NotoSansDevanagari',
  },
});

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -Recurse -File | Select-String -Pattern 'kek_key_arn'" in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -Recurse -File | Select-String -Pattern 'getMakingCharges\\('" in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -Recurse -File | Select-String -Pattern 'invoice.pan_not_captured|pan_decrypt'" in C:\Alok\Business Projects\Goldsmith
2026-04-25T20:38:34.226315Z ERROR codex_core::tools::router: error=Exit code: 124
Wall time: 120 seconds
Output:
command timed out after 120048 milliseconds

.serena\cache\typescript\document_symbols.pkl:9:      before,��      after,��    });��  }�h�;  async 
getMakingCharges(): Promise<MakingChargeConfig[]> {��4    const hit = await this.cache.getMakingCharges();��    if 
(hit) return hit;��6    const stored = await this.repo.getMakingCharges();��&    let configs: MakingChargeConfig[];�� 
   if (!stored) {��'      configs = MAKING_CHARGE_DEFAULTS;��    } else {��D      const storedMap = new 
Map(stored.map((c) => [c.category, c]));��R      configs = MAKING_CHARGE_DEFAULTS.map((d) => storedMap.get(d.category) 
?? d);��    }��/    await this.cache.setMakingCharges(configs);��    return configs;��  }�h�X  async 
updateMakingCharges(dto: PatchMakingChargesDto): Promise<MakingChargeConfig[]> {��;    const parsed = 
PatchMakingChargesSchema.safeParse(dto);��    if (!parsed.success) {��d      const errors = 
parsed.error.issues.map((i) => ({ field: i.path.join('.'), code: i.message }));��K      throw new 
BadRequestException({ code: 'validation.failed', errors });��    }�h�g    const { before, after } = await 
this.repo.upsertMakingCharges(parsed.data, MAKING_CHARGE_DEFAULTS);�h�/    await 
this.cache.invalidateMakingCharges();�h�M    void this.auditMakingChargesUpdate(before, after).catch(() => 
undefined);�h�    return after;��  }�h�)  private async auditMakingChargesUpdate(��(    before: 
MakingChargeConfig[] | null,��     after: MakingChargeConfig[],��  ): Promise<void> {��'    const tc = 
tenantContext.current();��    if (!tc) return;��    await auditLog(this.pool, {��:      action: 
AuditAction.SETTINGS_MAKING_CHARGES_UPDATED,��      subjectType: 'shop',��      subjectId: tc.shopId,��<      
actorUserId: tc.authenticated ? tc.userId : undefined,��
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:155:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:294:      
const result = await tenantContext.runWith(ctxA, () => r.getMakingCharges());
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:304:      
const result = await tenantContext.runWith(ctxA, () => r.getMakingCharges());
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:317:      
const result = await tenantContext.runWith(ctxA, () => r.getMakingCharges());
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:379:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:505:    const 
result = await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:512:    const 
result = await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:634:async 
getMakingCharges(): Promise<MakingChargeConfig[]> {
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:635:  const 
hit = await this.cache.getMakingCharges();
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:637:  const 
stored = await this.repo.getMakingCharges();
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:653:  const 
current = await this.getMakingCharges();
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:737:async 
getMakingCharges(
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:744:  const 
configs = await this.svc.getMakingCharges();
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:821:    
svc.getMakingCharges(),
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:848:    
svc.getMakingCharges(),
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\specs\2026-04-19-story-2.2-design.md:40:- Cache-first: 
`SettingsCache.getMakingCharges()` → DB miss → inject defaults if null
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\specs\2026-04-19-story-2.2-design.md:94:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null>
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\specs\2026-04-19-story-2.2-design.md:112:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null>
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\specs\2026-04-19-story-2.2-design.md:128:async 
getMakingCharges(): Promise<MakingChargeConfig[]>
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\specs\2026-04-19-story-2.2-design.md:130:  // cache miss → 
repo.getMakingCharges() → null? inject DEFAULTS
.worktrees\feat-story-2.4-loyalty-config\apps\api\src\modules\settings\settings.controller.ts:68:  async 
getMakingCharges(
.worktrees\feat-story-2.4-loyalty-config\apps\api\src\modules\settings\settings.controller.ts:74:    const configs = 
await this.svc.getMakingCharges();
.worktrees\feat-story-2.4-loyalty-config\apps\api\src\modules\settings\settings.repository.test.ts:113:      const 
result = await tenantContext.runWith(ctxA, () => testRepo.getMakingCharges());
.worktrees\feat-story-2.4-loyalty-config\apps\api\src\modules\settings\settings.repository.test.ts:131:      const 
result = await tenantContext.runWith(ctxA, () => testRepo.getMakingCharges());
.worktrees\feat-story-2.4-loyalty-config\apps\api\src\modules\settings\settings.repository.test.ts:146:      const 
result = await tenantContext.runWith(ctxA, () => testRepo.getMakingCharges());
.worktrees\feat-story-2.4-loyalty-config\apps\api\src\modules\settings\settings.repository.ts:72:  async 
getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-2.4-loyalty-config\apps\api\src\modules\settings\settings.service.test.ts:125:      const result 
= await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-2.4-loyalty-config\apps\api\src\modules\settings\settings.service.test.ts:133:      const result 
= await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-2.4-loyalty-config\apps\api\src\modules\settings\settings.service.test.ts:143:      const result 
= await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-2.4-loyalty-config\apps\api\src\modules\settings\settings.service.ts:136:  async 
getMakingCharges(): Promise<MakingChargeConfig[]> {
.worktrees\feat-story-2.4-loyalty-config\apps\api\src\modules\settings\settings.service.ts:137:    const hit = await 
this.cache.getMakingCharges();
.worktrees\feat-story-2.4-loyalty-config\apps\api\src\modules\settings\settings.service.ts:139:    const stored = 
await this.repo.getMakingCharges();
.worktrees\feat-story-2.4-loyalty-config\apps\api\test\settings\settings.integration.test.ts:288:      
svc.getMakingCharges(),
.worktrees\feat-story-2.4-loyalty-config\apps\api\test\settings\settings.integration.test.ts:312:      
svc.getMakingCharges(),
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:155:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:294:      const 
result = await tenantContext.runWith(ctxA, () => r.getMakingCharges());
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:304:      const 
result = await tenantContext.runWith(ctxA, () => r.getMakingCharges());
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:317:      const 
result = await tenantContext.runWith(ctxA, () => r.getMakingCharges());
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:379:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:505:    const 
result = await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:512:    const 
result = await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:634:async 
getMakingCharges(): Promise<MakingChargeConfig[]> {
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:635:  const hit 
= await this.cache.getMakingCharges();
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:637:  const 
stored = await this.repo.getMakingCharges();
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:653:  const 
current = await this.getMakingCharges();
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:737:async 
getMakingCharges(
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:744:  const 
configs = await this.svc.getMakingCharges();
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:821:    
svc.getMakingCharges(),
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:848:    
svc.getMakingCharges(),
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\specs\2026-04-19-story-2.2-design.md:40:- Cache-first: 
`SettingsCache.getMakingCharges()` → DB miss → inject defaults if null
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\specs\2026-04-19-story-2.2-design.md:94:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null>
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\specs\2026-04-19-story-2.2-design.md:112:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null>
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\specs\2026-04-19-story-2.2-design.md:128:async 
getMakingCharges(): Promise<MakingChargeConfig[]>
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\specs\2026-04-19-story-2.2-design.md:130:  // cache miss → 
repo.getMakingCharges() → null? inject DEFAULTS
.worktrees\feat-story-2.4-loyalty-config\packages\tenant-config\src\settings-cache.ts:47:  async getMakingCharges(): 
Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\dist\modules\settings\settings.controller.d.ts:14:    
getMakingCharges(ctx: TenantContext, res: Response): Promise<MakingChargesResponseDto>;
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\dist\modules\settings\settings.controller.js:56:    async 
getMakingCharges(ctx, res) {
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\dist\modules\settings\settings.controller.js:61:        const 
configs = await this.svc.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\dist\modules\settings\settings.repository.d.ts:10:    
getMakingCharges(): Promise<MakingChargeConfig[] | null>;
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\dist\modules\settings\settings.repository.js:58:    async 
getMakingCharges() {
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\dist\modules\settings\settings.service.d.ts:31:    
getMakingCharges(): Promise<MakingChargeConfig[]>;
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\dist\modules\settings\settings.service.js:225:    async 
getMakingCharges() {
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\dist\modules\settings\settings.service.js:226:        const hit 
= await this.cache.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\dist\modules\settings\settings.service.js:229:        const 
stored = await this.repo.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\src\modules\settings\settings.controller.ts:75:  async 
getMakingCharges(
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\src\modules\settings\settings.controller.ts:81:    const 
configs = await this.svc.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\src\modules\settings\settings.repository.test.ts:113:      
const result = await tenantContext.runWith(ctxA, () => testRepo.getMakingCharges());
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\src\modules\settings\settings.repository.test.ts:131:      
const result = await tenantContext.runWith(ctxA, () => testRepo.getMakingCharges());
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\src\modules\settings\settings.repository.test.ts:146:      
const result = await tenantContext.runWith(ctxA, () => testRepo.getMakingCharges());
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\src\modules\settings\settings.repository.ts:72:  async 
getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\src\modules\settings\settings.service.test.ts:135:      const 
result = await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\src\modules\settings\settings.service.test.ts:143:      const 
result = await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\src\modules\settings\settings.service.test.ts:153:      const 
result = await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\src\modules\settings\settings.service.ts:249:  async 
getMakingCharges(): Promise<MakingChargeConfig[]> {
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\src\modules\settings\settings.service.ts:250:    const hit = 
await this.cache.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\src\modules\settings\settings.service.ts:252:    const stored = 
await this.repo.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\test\settings\settings.integration.test.ts:298:      
svc.getMakingCharges(),
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\test\settings\settings.integration.test.ts:322:      
svc.getMakingCharges(),
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1405.md:1052:apps\api\src\modules\settings\se
ttings.service.ts:136:  async getMakingCharges(): Promise<MakingChargeConfig[]> {
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1405.md:1078:packages\tenant-config\src\setti
ngs-cache.ts:47:  async getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1405.md:1084:apps\api\src\modules\settings\se
ttings.repository.ts:72:  async getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1405.md:1255:  async getMakingCharges(
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1405.md:1261:    const configs = await 
this.svc.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1405.md:2152:  async getMakingCharges(): 
Promise<MakingChargeConfig[]> {
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1405.md:2153:    const hit = await 
this.cache.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1405.md:2155:    const stored = await 
this.repo.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1657.md:5115:251:  async getMakingCharges(): 
Promise<MakingChargeConfig[]> {
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1657.md:5116:252:    const hit = await 
this.cache.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1657.md:5118:254:    const stored = await 
this.repo.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:155:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:294:      
const result = await tenantContext.runWith(ctxA, () => r.getMakingCharges());
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:304:      
const result = await tenantContext.runWith(ctxA, () => r.getMakingCharges());
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:317:      
const result = await tenantContext.runWith(ctxA, () => r.getMakingCharges());
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:379:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:505:    
const result = await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:512:    
const result = await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:634:async 
getMakingCharges(): Promise<MakingChargeConfig[]> {
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:635:  
const hit = await this.cache.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:637:  
const stored = await this.repo.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:653:  
const current = await this.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:737:async 
getMakingCharges(
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:744:  
const configs = await this.svc.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:821:    
svc.getMakingCharges(),
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:848:    
svc.getMakingCharges(),
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\specs\2026-04-19-story-2.2-design.md:40:- Cache-first: 
`SettingsCache.getMakingCharges()` → DB miss → inject defaults if null
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\specs\2026-04-19-story-2.2-design.md:94:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null>
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\specs\2026-04-19-story-2.2-design.md:112:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null>
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\specs\2026-04-19-story-2.2-design.md:128:async 
getMakingCharges(): Promise<MakingChargeConfig[]>
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\specs\2026-04-19-story-2.2-design.md:130:  // cache 
miss → repo.getMakingCharges() → null? inject DEFAULTS
.worktrees\feat-story-3.7-valuation-dashboard\packages\tenant-config\dist\settings-cache.d.ts:18:    
getMakingCharges(): Promise<MakingChargeConfig[] | null>;
.worktrees\feat-story-3.7-valuation-dashboard\packages\tenant-config\dist\settings-cache.js:49:    async 
getMakingCharges() {
.worktrees\feat-story-3.7-valuation-dashboard\packages\tenant-config\src\settings-cache.ts:47:  async 
getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1405.md:1052:apps\api\src\modules\settings\
settings.service.ts:136:  async getMakingCharges(): Promise<MakingChargeConfig[]> {
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1405.md:1078:packages\tenant-config\src\set
tings-cache.ts:47:  async getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1405.md:1084:apps\api\src\modules\settings\
settings.repository.ts:72:  async getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1405.md:1255:  async getMakingCharges(
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1405.md:1261:    const configs = await 
this.svc.getMakingCharges();
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1405.md:2152:  async getMakingCharges(): 
Promise<MakingChargeConfig[]> {
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1405.md:2153:    const hit = await 
this.cache.getMakingCharges();
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1405.md:2155:    const stored = await 
this.repo.getMakingCharges();
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1657.md:5115:251:  async 
getMakingCharges(): Promise<MakingChargeConfig[]> {
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1657.md:5116:252:    const hit = await 
this.cache.getMakingCharges();
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1657.md:5118:254:    const stored = await 
this.repo.getMakingCharges();
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:155:async
 getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:294:     
 const result = await tenantContext.runWith(ctxA, () => r.getMakingCharges());
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:304:     
 const result = await tenantContext.runWith(ctxA, () => r.getMakingCharges());
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:317:     
 const result = await tenantContext.runWith(ctxA, () => r.getMakingCharges());
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:379:async
 getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:505:    
const result = await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:512:    
const result = await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:634:async
 getMakingCharges(): Promise<MakingChargeConfig[]> {
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:635:  
const hit = await this.cache.getMakingCharges();
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:637:  
const stored = await this.repo.getMakingCharges();
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:653:  
const current = await this.getMakingCharges();
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:737:async
 getMakingCharges(
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:744:  
const configs = await this.svc.getMakingCharges();
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:821:    
svc.getMakingCharges(),
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:848:    
svc.getMakingCharges(),
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\specs\2026-04-19-story-2.2-design.md:40:- 
Cache-first: `SettingsCache.getMakingCharges()` → DB miss → inject defaults if null
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\specs\2026-04-19-story-2.2-design.md:94:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null>
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\specs\2026-04-19-story-2.2-design.md:112:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null>
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\specs\2026-04-19-story-2.2-design.md:128:async 
getMakingCharges(): Promise<MakingChargeConfig[]>
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\specs\2026-04-19-story-2.2-design.md:130:  // cache 
miss → repo.getMakingCharges() → null? inject DEFAULTS

 exited 124 in 120048ms:

.serena\cache\typescript\document_symbols.pkl:9:      before,��      after,��    });��  }�h�;  async 
getMakingCharges(): Promise<MakingChargeConfig[]> {��4    const hit = await this.cache.getMakingCharges();��    if 
(hit) return hit;��6    const stored = await this.repo.getMakingCharges();��&    let configs: MakingChargeConfig[];�� 
   if (!stored) {��'      configs = MAKING_CHARGE_DEFAULTS;��    } else {��D      const storedMap = new 
Map(stored.map((c) => [c.category, c]));��R      configs = MAKING_CHARGE_DEFAULTS.map((d) => storedMap.get(d.category) 
?? d);��    }��/    await this.cache.setMakingCharges(configs);��    return configs;��  }�h�X  async 
updateMakingCharges(dto: PatchMakingChargesDto): Promise<MakingChargeConfig[]> {��;    const parsed = 
PatchMakingChargesSchema.safeParse(dto);��    if (!parsed.success) {��d      const errors = 
parsed.error.issues.map((i) => ({ field: i.path.join('.'), code: i.message }));��K      throw new 
BadRequestException({ code: 'validation.failed', errors });��    }�h�g    const { before, after } = await 
this.repo.upsertMakingCharges(parsed.data, MAKING_CHARGE_DEFAULTS);�h�/    await 
this.cache.invalidateMakingCharges();�h�M    void this.auditMakingChargesUpdate(before, after).catch(() => 
undefined);�h�    return after;��  }�h�)  private async auditMakingChargesUpdate(��(    before: 
MakingChargeConfig[] | null,��     after: MakingChargeConfig[],��  ): Promise<void> {��'    const tc = 
tenantContext.current();��    if (!tc) return;��    await auditLog(this.pool, {��:      action: 
AuditAction.SETTINGS_MAKING_CHARGES_UPDATED,��      subjectType: 'shop',��      subjectId: tc.shopId,��<      
actorUserId: tc.authenticated ? tc.userId : undefined,��
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:155:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:294:      
const result = await tenantContext.runWith(ctxA, () => r.getMakingCharges());
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:304:      
const result = await tenantContext.runWith(ctxA, () => r.getMakingCharges());
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:317:      
const result = await tenantContext.runWith(ctxA, () => r.getMakingCharges());
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:379:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:505:    const 
result = await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:512:    const 
result = await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:634:async 
getMakingCharges(): Promise<MakingChargeConfig[]> {
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:635:  const 
hit = await this.cache.getMakingCharges();
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:637:  const 
stored = await this.repo.getMakingCharges();
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:653:  const 
current = await this.getMakingCharges();
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:737:async 
getMakingCharges(
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:744:  const 
configs = await this.svc.getMakingCharges();
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:821:    
svc.getMakingCharges(),
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:848:    
svc.getMakingCharges(),
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\specs\2026-04-19-story-2.2-design.md:40:- Cache-first: 
`SettingsCache.getMakingCharges()` → DB miss → inject defaults if null
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\specs\2026-04-19-story-2.2-design.md:94:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null>
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\specs\2026-04-19-story-2.2-design.md:112:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null>
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\specs\2026-04-19-story-2.2-design.md:128:async 
getMakingCharges(): Promise<MakingChargeConfig[]>
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\specs\2026-04-19-story-2.2-design.md:130:  // cache miss → 
repo.getMakingCharges() → null? inject DEFAULTS
.worktrees\feat-story-2.4-loyalty-config\apps\api\src\modules\settings\settings.controller.ts:68:  async 
getMakingCharges(
.worktrees\feat-story-2.4-loyalty-config\apps\api\src\modules\settings\settings.controller.ts:74:    const configs = 
await this.svc.getMakingCharges();
.worktrees\feat-story-2.4-loyalty-config\apps\api\src\modules\settings\settings.repository.test.ts:113:      const 
result = await tenantContext.runWith(ctxA, () => testRepo.getMakingCharges());
.worktrees\feat-story-2.4-loyalty-config\apps\api\src\modules\settings\settings.repository.test.ts:131:      const 
result = await tenantContext.runWith(ctxA, () => testRepo.getMakingCharges());
.worktrees\feat-story-2.4-loyalty-config\apps\api\src\modules\settings\settings.repository.test.ts:146:      const 
result = await tenantContext.runWith(ctxA, () => testRepo.getMakingCharges());
.worktrees\feat-story-2.4-loyalty-config\apps\api\src\modules\settings\settings.repository.ts:72:  async 
getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-2.4-loyalty-config\apps\api\src\modules\settings\settings.service.test.ts:125:      const result 
= await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-2.4-loyalty-config\apps\api\src\modules\settings\settings.service.test.ts:133:      const result 
= await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-2.4-loyalty-config\apps\api\src\modules\settings\settings.service.test.ts:143:      const result 
= await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-2.4-loyalty-config\apps\api\src\modules\settings\settings.service.ts:136:  async 
getMakingCharges(): Promise<MakingChargeConfig[]> {
.worktrees\feat-story-2.4-loyalty-config\apps\api\src\modules\settings\settings.service.ts:137:    const hit = await 
this.cache.getMakingCharges();
.worktrees\feat-story-2.4-loyalty-config\apps\api\src\modules\settings\settings.service.ts:139:    const stored = 
await this.repo.getMakingCharges();
.worktrees\feat-story-2.4-loyalty-config\apps\api\test\settings\settings.integration.test.ts:288:      
svc.getMakingCharges(),
.worktrees\feat-story-2.4-loyalty-config\apps\api\test\settings\settings.integration.test.ts:312:      
svc.getMakingCharges(),
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:155:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:294:      const 
result = await tenantContext.runWith(ctxA, () => r.getMakingCharges());
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:304:      const 
result = await tenantContext.runWith(ctxA, () => r.getMakingCharges());
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:317:      const 
result = await tenantContext.runWith(ctxA, () => r.getMakingCharges());
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:379:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:505:    const 
result = await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:512:    const 
result = await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:634:async 
getMakingCharges(): Promise<MakingChargeConfig[]> {
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:635:  const hit 
= await this.cache.getMakingCharges();
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:637:  const 
stored = await this.repo.getMakingCharges();
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:653:  const 
current = await this.getMakingCharges();
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:737:async 
getMakingCharges(
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:744:  const 
configs = await this.svc.getMakingCharges();
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:821:    
svc.getMakingCharges(),
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:848:    
svc.getMakingCharges(),
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\specs\2026-04-19-story-2.2-design.md:40:- Cache-first: 
`SettingsCache.getMakingCharges()` → DB miss → inject defaults if null
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\specs\2026-04-19-story-2.2-design.md:94:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null>
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\specs\2026-04-19-story-2.2-design.md:112:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null>
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\specs\2026-04-19-story-2.2-design.md:128:async 
getMakingCharges(): Promise<MakingChargeConfig[]>
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\specs\2026-04-19-story-2.2-design.md:130:  // cache miss → 
repo.getMakingCharges() → null? inject DEFAULTS
.worktrees\feat-story-2.4-loyalty-config\packages\tenant-config\src\settings-cache.ts:47:  async getMakingCharges(): 
Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\dist\modules\settings\settings.controller.d.ts:14:    
getMakingCharges(ctx: TenantContext, res: Response): Promise<MakingChargesResponseDto>;
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\dist\modules\settings\settings.controller.js:56:    async 
getMakingCharges(ctx, res) {
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\dist\modules\settings\settings.controller.js:61:        const 
configs = await this.svc.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\dist\modules\settings\settings.repository.d.ts:10:    
getMakingCharges(): Promise<MakingChargeConfig[] | null>;
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\dist\modules\settings\settings.repository.js:58:    async 
getMakingCharges() {
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\dist\modules\settings\settings.service.d.ts:31:    
getMakingCharges(): Promise<MakingChargeConfig[]>;
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\dist\modules\settings\settings.service.js:225:    async 
getMakingCharges() {
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\dist\modules\settings\settings.service.js:226:        const hit 
= await this.cache.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\dist\modules\settings\settings.service.js:229:        const 
stored = await this.repo.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\src\modules\settings\settings.controller.ts:75:  async 
getMakingCharges(
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\src\modules\settings\settings.controller.ts:81:    const 
configs = await this.svc.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\src\modules\settings\settings.repository.test.ts:113:      
const result = await tenantContext.runWith(ctxA, () => testRepo.getMakingCharges());
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\src\modules\settings\settings.repository.test.ts:131:      
const result = await tenantContext.runWith(ctxA, () => testRepo.getMakingCharges());
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\src\modules\settings\settings.repository.test.ts:146:      
const result = await tenantContext.runWith(ctxA, () => testRepo.getMakingCharges());
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\src\modules\settings\settings.repository.ts:72:  async 
getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\src\modules\settings\settings.service.test.ts:135:      const 
result = await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\src\modules\settings\settings.service.test.ts:143:      const 
result = await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\src\modules\settings\settings.service.test.ts:153:      const 
result = await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\src\modules\settings\settings.service.ts:249:  async 
getMakingCharges(): Promise<MakingChargeConfig[]> {
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\src\modules\settings\settings.service.ts:250:    const hit = 
await this.cache.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\src\modules\settings\settings.service.ts:252:    const stored = 
await this.repo.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\test\settings\settings.integration.test.ts:298:      
svc.getMakingCharges(),
.worktrees\feat-story-3.7-valuation-dashboard\apps\api\test\settings\settings.integration.test.ts:322:      
svc.getMakingCharges(),
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1405.md:1052:apps\api\src\modules\settings\se
ttings.service.ts:136:  async getMakingCharges(): Promise<MakingChargeConfig[]> {
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1405.md:1078:packages\tenant-config\src\setti
ngs-cache.ts:47:  async getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1405.md:1084:apps\api\src\modules\settings\se
ttings.repository.ts:72:  async getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1405.md:1255:  async getMakingCharges(
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1405.md:1261:    const configs = await 
this.svc.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1405.md:2152:  async getMakingCharges(): 
Promise<MakingChargeConfig[]> {
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1405.md:2153:    const hit = await 
this.cache.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1405.md:2155:    const stored = await 
this.repo.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1657.md:5115:251:  async getMakingCharges(): 
Promise<MakingChargeConfig[]> {
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1657.md:5116:252:    const hit = await 
this.cache.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1657.md:5118:254:    const stored = await 
this.repo.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:155:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:294:      
const result = await tenantContext.runWith(ctxA, () => r.getMakingCharges());
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:304:      
const result = await tenantContext.runWith(ctxA, () => r.getMakingCharges());
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:317:      
const result = await tenantContext.runWith(ctxA, () => r.getMakingCharges());
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:379:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:505:    
const result = await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:512:    
const result = await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:634:async 
getMakingCharges(): Promise<MakingChargeConfig[]> {
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:635:  
const hit = await this.cache.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:637:  
const stored = await this.repo.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:653:  
const current = await this.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:737:async 
getMakingCharges(
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:744:  
const configs = await this.svc.getMakingCharges();
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:821:    
svc.getMakingCharges(),
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:848:    
svc.getMakingCharges(),
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\specs\2026-04-19-story-2.2-design.md:40:- Cache-first: 
`SettingsCache.getMakingCharges()` → DB miss → inject defaults if null
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\specs\2026-04-19-story-2.2-design.md:94:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null>
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\specs\2026-04-19-story-2.2-design.md:112:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null>
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\specs\2026-04-19-story-2.2-design.md:128:async 
getMakingCharges(): Promise<MakingChargeConfig[]>
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\specs\2026-04-19-story-2.2-design.md:130:  // cache 
miss → repo.getMakingCharges() → null? inject DEFAULTS
.worktrees\feat-story-3.7-valuation-dashboard\packages\tenant-config\dist\settings-cache.d.ts:18:    
getMakingCharges(): Promise<MakingChargeConfig[] | null>;
.worktrees\feat-story-3.7-valuation-dashboard\packages\tenant-config\dist\settings-cache.js:49:    async 
getMakingCharges() {
.worktrees\feat-story-3.7-valuation-dashboard\packages\tenant-config\src\settings-cache.ts:47:  async 
getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1405.md:1052:apps\api\src\modules\settings\
settings.service.ts:136:  async getMakingCharges(): Promise<MakingChargeConfig[]> {
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1405.md:1078:packages\tenant-config\src\set
tings-cache.ts:47:  async getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1405.md:1084:apps\api\src\modules\settings\
settings.repository.ts:72:  async getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1405.md:1255:  async getMakingCharges(
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1405.md:1261:    const configs = await 
this.svc.getMakingCharges();
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1405.md:2152:  async getMakingCharges(): 
Promise<MakingChargeConfig[]> {
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1405.md:2153:    const hit = await 
this.cache.getMakingCharges();
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1405.md:2155:    const stored = await 
this.repo.getMakingCharges();
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1657.md:5115:251:  async 
getMakingCharges(): Promise<MakingChargeConfig[]> {
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1657.md:5116:252:    const hit = await 
this.cache.getMakingCharges();
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1657.md:5118:254:    const stored = await 
this.repo.getMakingCharges();
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:155:async
 getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:294:     
 const result = await tenantContext.runWith(ctxA, () => r.getMakingCharges());
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:304:     
 const result = await tenantContext.runWith(ctxA, () => r.getMakingCharges());
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:317:     
 const result = await tenantContext.runWith(ctxA, () => r.getMakingCharges());
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:379:async
 getMakingCharges(): Promise<MakingChargeConfig[] | null> {
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:505:    
const result = await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:512:    
const result = await tenantContext.runWith(ctx, () => svc.getMakingCharges());
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:634:async
 getMakingCharges(): Promise<MakingChargeConfig[]> {
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:635:  
const hit = await this.cache.getMakingCharges();
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:637:  
const stored = await this.repo.getMakingCharges();
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:653:  
const current = await this.getMakingCharges();
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:737:async
 getMakingCharges(
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:744:  
const configs = await this.svc.getMakingCharges();
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:821:    
svc.getMakingCharges(),
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:848:    
svc.getMakingCharges(),
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\specs\2026-04-19-story-2.2-design.md:40:- 
Cache-first: `SettingsCache.getMakingCharges()` → DB miss → inject defaults if null
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\specs\2026-04-19-story-2.2-design.md:94:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null>
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\specs\2026-04-19-story-2.2-design.md:112:async 
getMakingCharges(): Promise<MakingChargeConfig[] | null>
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\specs\2026-04-19-story-2.2-design.md:128:async 
getMakingCharges(): Promise<MakingChargeConfig[]>
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\specs\2026-04-19-story-2.2-design.md:130:  // cache 
miss → repo.getMakingCharges() → null? inject DEFAULTS

 exited 124 in 120049ms:

.worktrees\feat-story-1.6-1.7-audit-logout\docs\reviews\codex-pr1.md:1812:+> - `tenant-provision.sh` inserts `shops` 
row + calls a Node helper that uses `LocalKMS.createKeyForTenant`. Result: a fake ARN string stored in 
`shops.kek_key_arn`. Real Azure Key Vault integration lands in the Infrastructure Story.
.worktrees\feat-story-1.6-1.7-audit-logout\docs\reviews\codex-pr1.md:2951:+  kek_key_arn   TEXT,
.worktrees\feat-story-1.6-1.7-audit-logout\docs\reviews\codex-pr1.md:3291:+  kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-1.6-1.7-audit-logout\docs\reviews\codex-pr1.md:14353:+psql "$DB_URL" -v ON_ERROR_STOP=1 -c 
"UPDATE shops SET kek_key_arn='$KEK_ARN', status='ACTIVE' WHERE id='$TENANT_ID';"
.worktrees\feat-story-1.6-1.7-audit-logout\docs\reviews\codex-pr1.md:14835:  kek_key_arn   TEXT,
.worktrees\feat-story-1.6-1.7-audit-logout\docs\reviews\codex-pr1.md:15667:  kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:1327:  
kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:1580:  
kek_key_arn   TEXT,
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:3974:> - 
`tenant-provision.sh` inserts `shops` row + calls a Node helper that uses `LocalKMS.createKeyForTenant`. Result: a 
fake ARN string stored in `shops.kek_key_arn`. Real Azure Key Vault integration lands in the Infrastructure Story.
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:4046:psql 
"$DB_URL" -v ON_ERROR_STOP=1 -c "UPDATE shops SET kek_key_arn='$KEK_ARN', status='ACTIVE' WHERE id='$TENANT_ID';"
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.1-shop-profile.md:620:  
kek_key_arn:          text('kek_key_arn'),
.worktrees\feat-story-1.6-1.7-audit-logout\scripts\tenant-provision.sh:45:  -c "UPDATE shops SET kek_key_arn=:'kek', 
status='ACTIVE' WHERE id=:'tenant_id'::uuid;"
.worktrees\feat-story-2.4-loyalty-config\docs\reviews\codex-pr1.md:1812:+> - `tenant-provision.sh` inserts `shops` row 
+ calls a Node helper that uses `LocalKMS.createKeyForTenant`. Result: a fake ARN string stored in 
`shops.kek_key_arn`. Real Azure Key Vault integration lands in the Infrastructure Story.
.worktrees\feat-story-2.4-loyalty-config\docs\reviews\codex-pr1.md:2951:+  kek_key_arn   TEXT,
.worktrees\feat-story-2.4-loyalty-config\docs\reviews\codex-pr1.md:3291:+  kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-2.4-loyalty-config\docs\reviews\codex-pr1.md:14353:+psql "$DB_URL" -v ON_ERROR_STOP=1 -c "UPDATE 
shops SET kek_key_arn='$KEK_ARN', status='ACTIVE' WHERE id='$TENANT_ID';"
.worktrees\feat-story-2.4-loyalty-config\docs\reviews\codex-pr1.md:14835:  kek_key_arn   TEXT,
.worktrees\feat-story-2.4-loyalty-config\docs\reviews\codex-pr1.md:15667:  kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:1327:  
kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:1580:  
kek_key_arn   TEXT,
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:3974:> - 
`tenant-provision.sh` inserts `shops` row + calls a Node helper that uses `LocalKMS.createKeyForTenant`. Result: a 
fake ARN string stored in `shops.kek_key_arn`. Real Azure Key Vault integration lands in the Infrastructure Story.
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:4046:psql 
"$DB_URL" -v ON_ERROR_STOP=1 -c "UPDATE shops SET kek_key_arn='$KEK_ARN', status='ACTIVE' WHERE id='$TENANT_ID';"
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.1-shop-profile.md:620:  
kek_key_arn:          text('kek_key_arn'),
.worktrees\feat-story-2.4-loyalty-config\packages\db\dist\schema\shops.d.ts:54:        kek_key_arn: 
import("drizzle-orm/pg-core").PgColumn<{
.worktrees\feat-story-2.4-loyalty-config\packages\db\dist\schema\shops.d.ts:55:            name: "kek_key_arn";
.worktrees\feat-story-2.4-loyalty-config\packages\db\dist\schema\shops.js:12:    kek_key_arn: (0, 
pg_core_1.text)('kek_key_arn'),
.worktrees\feat-story-2.4-loyalty-config\packages\db\src\migrations\0001_initial_schema.sql:17:  kek_key_arn   TEXT,
.worktrees\feat-story-2.4-loyalty-config\packages\db\src\schema\shops.ts:11:  kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-2.4-loyalty-config\scripts\tenant-provision.sh:45:  -c "UPDATE shops SET kek_key_arn=:'kek', 
status='ACTIVE' WHERE id=:'tenant_id'::uuid;"
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1657.md:4683:  kek_key_arn   TEXT,
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1657.md:5818:  `GRANT UPDATE ON shops TO 
app_user` widens the permission added in `0006_shop_settings.sql` from a small profile column list to every column on 
the row. The new RLS policy only limits *which row* a shop user can update, not *which fields*, so a shop admin can 
now change sensitive fields like `slug`, `status`, `config`, or `kek_key_arn` on their own shop. If the intent is only 
to unblock profile edits, this should remain a column-level `GRANT UPDATE (...)`.
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1657.md:5827:  `GRANT UPDATE ON shops TO 
app_user` widens the permission added in `0006_shop_settings.sql` from a small profile column list to every column on 
the row. The new RLS policy only limits *which row* a shop user can update, not *which fields*, so a shop admin can 
now change sensitive fields like `slug`, `status`, `config`, or `kek_key_arn` on their own shop. If the intent is only 
to unblock profile edits, this should remain a column-level `GRANT UPDATE (...)`.
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-pr1.md:1812:+> - `tenant-provision.sh` inserts 
`shops` row + calls a Node helper that uses `LocalKMS.createKeyForTenant`. Result: a fake ARN string stored in 
`shops.kek_key_arn`. Real Azure Key Vault integration lands in the Infrastructure Story.
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-pr1.md:2951:+  kek_key_arn   TEXT,
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-pr1.md:3291:+  kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-pr1.md:14353:+psql "$DB_URL" -v ON_ERROR_STOP=1 -c 
"UPDATE shops SET kek_key_arn='$KEK_ARN', status='ACTIVE' WHERE id='$TENANT_ID';"
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-pr1.md:14835:  kek_key_arn   TEXT,
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-pr1.md:15667:  kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-story-4.1-rerun.md:3223:  kek_key_arn: 
text('kek_key_arn'),
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:1327:  
kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:1580:  
kek_key_arn   TEXT,
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:3974:> 
- `tenant-provision.sh` inserts `shops` row + calls a Node helper that uses `LocalKMS.createKeyForTenant`. Result: a 
fake ARN string stored in `shops.kek_key_arn`. Real Azure Key Vault integration lands in the Infrastructure Story.
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:4046:ps
ql "$DB_URL" -v ON_ERROR_STOP=1 -c "UPDATE shops SET kek_key_arn='$KEK_ARN', status='ACTIVE' WHERE id='$TENANT_ID';"
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.1-shop-profile.md:620:  
kek_key_arn:          text('kek_key_arn'),
.worktrees\feat-story-3.7-valuation-dashboard\packages\db\dist\schema\shops.d.ts:54:        kek_key_arn: 
import("drizzle-orm/pg-core").PgColumn<{
.worktrees\feat-story-3.7-valuation-dashboard\packages\db\dist\schema\shops.d.ts:55:            name: "kek_key_arn";
.worktrees\feat-story-3.7-valuation-dashboard\packages\db\dist\schema\shops.js:15:    kek_key_arn: (0, 
pg_core_1.text)('kek_key_arn'),
.worktrees\feat-story-3.7-valuation-dashboard\packages\db\src\migrations\0001_initial_schema.sql:17:  kek_key_arn   
TEXT,
.worktrees\feat-story-3.7-valuation-dashboard\packages\db\src\migrations\0013_shops_revoke_app_user_write.sql:12:-- 
Sensitive columns (slug, status, kek_key_arn, config) are intentionally
.worktrees\feat-story-3.7-valuation-dashboard\packages\db\src\schema\shops.ts:14:  kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-3.7-valuation-dashboard\scripts\tenant-provision.sh:45:  -c "UPDATE shops SET 
kek_key_arn=:'kek', status='ACTIVE' WHERE id=:'tenant_id'::uuid;"
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1657.md:4683:  kek_key_arn   TEXT,
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1657.md:5818:  `GRANT UPDATE ON shops TO 
app_user` widens the permission added in `0006_shop_settings.sql` from a small profile column list to every column on 
the row. The new RLS policy only limits *which row* a shop user can update, not *which fields*, so a shop admin can 
now change sensitive fields like `slug`, `status`, `config`, or `kek_key_arn` on their own shop. If the intent is only 
to unblock profile edits, this should remain a column-level `GRANT UPDATE (...)`.
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1657.md:5827:  `GRANT UPDATE ON shops TO 
app_user` widens the permission added in `0006_shop_settings.sql` from a small profile column list to every column on 
the row. The new RLS policy only limits *which row* a shop user can update, not *which fields*, so a shop admin can 
now change sensitive fields like `slug`, `status`, `config`, or `kek_key_arn` on their own shop. If the intent is only 
to unblock profile edits, this should remain a column-level `GRANT UPDATE (...)`.
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-pr1.md:1812:+> - `tenant-provision.sh` inserts 
`shops` row + calls a Node helper that uses `LocalKMS.createKeyForTenant`. Result: a fake ARN string stored in 
`shops.kek_key_arn`. Real Azure Key Vault integration lands in the Infrastructure Story.
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-pr1.md:2951:+  kek_key_arn   TEXT,
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-pr1.md:3291:+  kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-pr1.md:14353:+psql "$DB_URL" -v ON_ERROR_STOP=1 -c 
"UPDATE shops SET kek_key_arn='$KEK_ARN', status='ACTIVE' WHERE id='$TENANT_ID';"
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-pr1.md:14835:  kek_key_arn   TEXT,
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-pr1.md:15667:  kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-story-4.1-rerun.md:3223:  kek_key_arn: 
text('kek_key_arn'),
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:1327:
  kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:1580:
  kek_key_arn   TEXT,
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:3974:
> - `tenant-provision.sh` inserts `shops` row + calls a Node helper that uses `LocalKMS.createKeyForTenant`. Result: a 
fake ARN string stored in `shops.kek_key_arn`. Real Azure Key Vault integration lands in the Infrastructure Story.
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:4046:
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "UPDATE shops SET kek_key_arn='$KEK_ARN', status='ACTIVE' WHERE id='$TENANT_ID';"
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.1-shop-profile.md:620:  
kek_key_arn:          text('kek_key_arn'),

2026-04-25T20:38:34.226685Z ERROR codex_core::tools::router: error=Exit code: 124
Wall time: 120 seconds
Output:
command timed out after 120049 milliseconds

.worktrees\feat-story-1.6-1.7-audit-logout\docs\reviews\codex-pr1.md:1812:+> - `tenant-provision.sh` inserts `shops` 
row + calls a Node helper that uses `LocalKMS.createKeyForTenant`. Result: a fake ARN string stored in 
`shops.kek_key_arn`. Real Azure Key Vault integration lands in the Infrastructure Story.
.worktrees\feat-story-1.6-1.7-audit-logout\docs\reviews\codex-pr1.md:2951:+  kek_key_arn   TEXT,
.worktrees\feat-story-1.6-1.7-audit-logout\docs\reviews\codex-pr1.md:3291:+  kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-1.6-1.7-audit-logout\docs\reviews\codex-pr1.md:14353:+psql "$DB_URL" -v ON_ERROR_STOP=1 -c 
"UPDATE shops SET kek_key_arn='$KEK_ARN', status='ACTIVE' WHERE id='$TENANT_ID';"
.worktrees\feat-story-1.6-1.7-audit-logout\docs\reviews\codex-pr1.md:14835:  kek_key_arn   TEXT,
.worktrees\feat-story-1.6-1.7-audit-logout\docs\reviews\codex-pr1.md:15667:  kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:1327:  
kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:1580:  
kek_key_arn   TEXT,
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:3974:> - 
`tenant-provision.sh` inserts `shops` row + calls a Node helper that uses `LocalKMS.createKeyForTenant`. Result: a 
fake ARN string stored in `shops.kek_key_arn`. Real Azure Key Vault integration lands in the Infrastructure Story.
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:4046:psql 
"$DB_URL" -v ON_ERROR_STOP=1 -c "UPDATE shops SET kek_key_arn='$KEK_ARN', status='ACTIVE' WHERE id='$TENANT_ID';"
.worktrees\feat-story-1.6-1.7-audit-logout\docs\superpowers\plans\2026-04-19-story-2.1-shop-profile.md:620:  
kek_key_arn:          text('kek_key_arn'),
.worktrees\feat-story-1.6-1.7-audit-logout\scripts\tenant-provision.sh:45:  -c "UPDATE shops SET kek_key_arn=:'kek', 
status='ACTIVE' WHERE id=:'tenant_id'::uuid;"
.worktrees\feat-story-2.4-loyalty-config\docs\reviews\codex-pr1.md:1812:+> - `tenant-provision.sh` inserts `shops` row 
+ calls a Node helper that uses `LocalKMS.createKeyForTenant`. Result: a fake ARN string stored in 
`shops.kek_key_arn`. Real Azure Key Vault integration lands in the Infrastructure Story.
.worktrees\feat-story-2.4-loyalty-config\docs\reviews\codex-pr1.md:2951:+  kek_key_arn   TEXT,
.worktrees\feat-story-2.4-loyalty-config\docs\reviews\codex-pr1.md:3291:+  kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-2.4-loyalty-config\docs\reviews\codex-pr1.md:14353:+psql "$DB_URL" -v ON_ERROR_STOP=1 -c "UPDATE 
shops SET kek_key_arn='$KEK_ARN', status='ACTIVE' WHERE id='$TENANT_ID';"
.worktrees\feat-story-2.4-loyalty-config\docs\reviews\codex-pr1.md:14835:  kek_key_arn   TEXT,
.worktrees\feat-story-2.4-loyalty-config\docs\reviews\codex-pr1.md:15667:  kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:1327:  
kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:1580:  
kek_key_arn   TEXT,
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:3974:> - 
`tenant-provision.sh` inserts `shops` row + calls a Node helper that uses `LocalKMS.createKeyForTenant`. Result: a 
fake ARN string stored in `shops.kek_key_arn`. Real Azure Key Vault integration lands in the Infrastructure Story.
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:4046:psql 
"$DB_URL" -v ON_ERROR_STOP=1 -c "UPDATE shops SET kek_key_arn='$KEK_ARN', status='ACTIVE' WHERE id='$TENANT_ID';"
.worktrees\feat-story-2.4-loyalty-config\docs\superpowers\plans\2026-04-19-story-2.1-shop-profile.md:620:  
kek_key_arn:          text('kek_key_arn'),
.worktrees\feat-story-2.4-loyalty-config\packages\db\dist\schema\shops.d.ts:54:        kek_key_arn: 
import("drizzle-orm/pg-core").PgColumn<{
.worktrees\feat-story-2.4-loyalty-config\packages\db\dist\schema\shops.d.ts:55:            name: "kek_key_arn";
.worktrees\feat-story-2.4-loyalty-config\packages\db\dist\schema\shops.js:12:    kek_key_arn: (0, 
pg_core_1.text)('kek_key_arn'),
.worktrees\feat-story-2.4-loyalty-config\packages\db\src\migrations\0001_initial_schema.sql:17:  kek_key_arn   TEXT,
.worktrees\feat-story-2.4-loyalty-config\packages\db\src\schema\shops.ts:11:  kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-2.4-loyalty-config\scripts\tenant-provision.sh:45:  -c "UPDATE shops SET kek_key_arn=:'kek', 
status='ACTIVE' WHERE id=:'tenant_id'::uuid;"
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1657.md:4683:  kek_key_arn   TEXT,
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1657.md:5818:  `GRANT UPDATE ON shops TO 
app_user` widens the permission added in `0006_shop_settings.sql` from a small profile column list to every column on 
the row. The new RLS policy only limits *which row* a shop user can update, not *which fields*, so a shop admin can 
now change sensitive fields like `slug`, `status`, `config`, or `kek_key_arn` on their own shop. If the intent is only 
to unblock profile edits, this should remain a column-level `GRANT UPDATE (...)`.
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-20260423-1657.md:5827:  `GRANT UPDATE ON shops TO 
app_user` widens the permission added in `0006_shop_settings.sql` from a small profile column list to every column on 
the row. The new RLS policy only limits *which row* a shop user can update, not *which fields*, so a shop admin can 
now change sensitive fields like `slug`, `status`, `config`, or `kek_key_arn` on their own shop. If the intent is only 
to unblock profile edits, this should remain a column-level `GRANT UPDATE (...)`.
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-pr1.md:1812:+> - `tenant-provision.sh` inserts 
`shops` row + calls a Node helper that uses `LocalKMS.createKeyForTenant`. Result: a fake ARN string stored in 
`shops.kek_key_arn`. Real Azure Key Vault integration lands in the Infrastructure Story.
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-pr1.md:2951:+  kek_key_arn   TEXT,
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-pr1.md:3291:+  kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-pr1.md:14353:+psql "$DB_URL" -v ON_ERROR_STOP=1 -c 
"UPDATE shops SET kek_key_arn='$KEK_ARN', status='ACTIVE' WHERE id='$TENANT_ID';"
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-pr1.md:14835:  kek_key_arn   TEXT,
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-pr1.md:15667:  kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-3.7-valuation-dashboard\docs\reviews\codex-story-4.1-rerun.md:3223:  kek_key_arn: 
text('kek_key_arn'),
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:1327:  
kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:1580:  
kek_key_arn   TEXT,
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:3974:> 
- `tenant-provision.sh` inserts `shops` row + calls a Node helper that uses `LocalKMS.createKeyForTenant`. Result: a 
fake ARN string stored in `shops.kek_key_arn`. Real Azure Key Vault integration lands in the Infrastructure Story.
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:4046:ps
ql "$DB_URL" -v ON_ERROR_STOP=1 -c "UPDATE shops SET kek_key_arn='$KEK_ARN', status='ACTIVE' WHERE id='$TENANT_ID';"
.worktrees\feat-story-3.7-valuation-dashboard\docs\superpowers\plans\2026-04-19-story-2.1-shop-profile.md:620:  
kek_key_arn:          text('kek_key_arn'),
.worktrees\feat-story-3.7-valuation-dashboard\packages\db\dist\schema\shops.d.ts:54:        kek_key_arn: 
import("drizzle-orm/pg-core").PgColumn<{
.worktrees\feat-story-3.7-valuation-dashboard\packages\db\dist\schema\shops.d.ts:55:            name: "kek_key_arn";
.worktrees\feat-story-3.7-valuation-dashboard\packages\db\dist\schema\shops.js:15:    kek_key_arn: (0, 
pg_core_1.text)('kek_key_arn'),
.worktrees\feat-story-3.7-valuation-dashboard\packages\db\src\migrations\0001_initial_schema.sql:17:  kek_key_arn   
TEXT,
.worktrees\feat-story-3.7-valuation-dashboard\packages\db\src\migrations\0013_shops_revoke_app_user_write.sql:12:-- 
Sensitive columns (slug, status, kek_key_arn, config) are intentionally
.worktrees\feat-story-3.7-valuation-dashboard\packages\db\src\schema\shops.ts:14:  kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-3.7-valuation-dashboard\scripts\tenant-provision.sh:45:  -c "UPDATE shops SET 
kek_key_arn=:'kek', status='ACTIVE' WHERE id=:'tenant_id'::uuid;"
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1657.md:4683:  kek_key_arn   TEXT,
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1657.md:5818:  `GRANT UPDATE ON shops TO 
app_user` widens the permission added in `0006_shop_settings.sql` from a small profile column list to every column on 
the row. The new RLS policy only limits *which row* a shop user can update, not *which fields*, so a shop admin can 
now change sensitive fields like `slug`, `status`, `config`, or `kek_key_arn` on their own shop. If the intent is only 
to unblock profile edits, this should remain a column-level `GRANT UPDATE (...)`.
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-20260423-1657.md:5827:  `GRANT UPDATE ON shops TO 
app_user` widens the permission added in `0006_shop_settings.sql` from a small profile column list to every column on 
the row. The new RLS policy only limits *which row* a shop user can update, not *which fields*, so a shop admin can 
now change sensitive fields like `slug`, `status`, `config`, or `kek_key_arn` on their own shop. If the intent is only 
to unblock profile edits, this should remain a column-level `GRANT UPDATE (...)`.
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-pr1.md:1812:+> - `tenant-provision.sh` inserts 
`shops` row + calls a Node helper that uses `LocalKMS.createKeyForTenant`. Result: a fake ARN string stored in 
`shops.kek_key_arn`. Real Azure Key Vault integration lands in the Infrastructure Story.
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-pr1.md:2951:+  kek_key_arn   TEXT,
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-pr1.md:3291:+  kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-pr1.md:14353:+psql "$DB_URL" -v ON_ERROR_STOP=1 -c 
"UPDATE shops SET kek_key_arn='$KEK_ARN', status='ACTIVE' WHERE id='$TENANT_ID';"
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-pr1.md:14835:  kek_key_arn   TEXT,
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-pr1.md:15667:  kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-4.1-gold-rates-foundation\docs\reviews\codex-story-4.1-rerun.md:3223:  kek_key_arn: 
text('kek_key_arn'),
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:1327:
  kek_key_arn: text('kek_key_arn'),
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:1580:
  kek_key_arn   TEXT,
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:3974:
> - `tenant-provision.sh` inserts `shops` row + calls a Node helper that uses `LocalKMS.createKeyForTenant`. Result: a 
fake ARN string stored in `shops.kek_key_arn`. Real Azure Key Vault integration lands in the Infrastructure Story.
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:4046:
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "UPDATE shops SET kek_key_arn='$KEK_ARN', status='ACTIVE' WHERE id='$TENANT_ID';"
.worktrees\feat-story-4.1-gold-rates-foundation\docs\superpowers\plans\2026-04-19-story-2.1-shop-profile.md:620:  
kek_key_arn:          text('kek_key_arn'),

2026-04-25T20:38:34.322234Z ERROR codex_core::tools::router: error=Exit code: 124
Wall time: 120 seconds
Output:
command timed out after 120021 milliseconds

 exited 124 in 120021ms:
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content 'apps/api/src/modules/settings/settings.repository.ts'" in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content 'packages/tenant-config/src/settings-cache.ts'" in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content 'apps/api/src/modules/settings/settings.service.ts'" in C:\Alok\Business Projects\Goldsmith
 succeeded in 292ms:
import type { Redis } from '@goldsmith/cache';
import type { LoyaltyConfig, ShopProfileRow, MakingChargeConfig, WastageConfig, NotificationPrefsConfig } from '@goldsmith/shared';
import { LoyaltyConfigSchema, ShopProfileRowSchema, MakingChargesArraySchema, WastageArraySchema, NotificationPrefsSchema } from '@goldsmith/shared';
import { tenantContext } from '@goldsmith/tenant-context';

/**
 * Redis-backed cache for shop settings.
 *
 * Contract:
 * - get* methods: swallow Redis errors + JSON parse errors as cache misses (delete corrupt key).
 * - set* / invalidate* methods: Redis errors propagate to the caller.
 */
export class SettingsCache {
  private static readonly DEFAULT_TTL_SEC = 60;

  constructor(
    private readonly redis: Redis,
    private readonly ttlSec = SettingsCache.DEFAULT_TTL_SEC,
  ) {}

  async getProfile(): Promise<ShopProfileRow | null> {
    const key = this.profileKey();
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      const result = ShopProfileRowSchema.safeParse(parsed);
      if (!result.success) {
        await this.redis.del(key);
        return null;
      }
      return result.data;
    } catch {
      try { await this.redis.del(key); } catch { /* ignore del failure */ }
      return null;
    }
  }

  async setProfile(data: ShopProfileRow): Promise<void> {
    await this.redis.set(this.profileKey(), JSON.stringify(data), 'EX', this.ttlSec);
  }

  async invalidate(): Promise<void> {
    await this.redis.del(this.profileKey());
  }

  async getMakingCharges(): Promise<MakingChargeConfig[] | null> {
    const key = this.makingChargesKey();
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      const result = MakingChargesArraySchema.safeParse(parsed);
      if (!result.success) {
        await this.redis.del(key);
        return null;
      }
      return result.data;
    } catch {
      try { await this.redis.del(key); } catch { /* ignore del failure */ }
      return null;
    }
  }

  async setMakingCharges(data: MakingChargeConfig[]): Promise<void> {
    await this.redis.set(this.makingChargesKey(), JSON.stringify(data), 'EX', this.ttlSec);
  }

  async invalidateMakingCharges(): Promise<void> {
    await this.redis.del(this.makingChargesKey());
  }

  async getWastage(): Promise<WastageConfig[] | null> {
    const key = this.wastageKey();
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      const result = WastageArraySchema.safeParse(parsed);
      if (!result.success) {
        await this.redis.del(key);
        return null;
      }
      return result.data;
    } catch {
      try { await this.redis.del(key); } catch { /* ignore del failure */ }
      return null;
    }
  }

  async setWastage(data: WastageConfig[]): Promise<void> {
    await this.redis.set(this.wastageKey(), JSON.stringify(data), 'EX', this.ttlSec);
  }

  async invalidateWastage(): Promise<void> {
    await this.redis.del(this.wastageKey());
  }

  async getRateLock(): Promise<number | null> {
    const key = this.rateLockKey();
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'number' || !Number.isInteger(parsed)) {
        await this.redis.del(key);
        return null;
      }
      return parsed;
    } catch {
      try { await this.redis.del(key); } catch { /* ignore del failure */ }
      return null;
    }
  }

  async setRateLock(days: number): Promise<void> {
    await this.redis.set(this.rateLockKey(), JSON.stringify(days), 'EX', this.ttlSec);
  }

  async invalidateRateLock(): Promise<void> {
    await this.redis.del(this.rateLockKey());
  }

  async getLoyalty(): Promise<LoyaltyConfig | null> {
    const key = this.loyaltyKey();
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      const result = LoyaltyConfigSchema.safeParse(parsed);
      if (!result.success) {
        await this.redis.del(key);
        return null;
      }
      return result.data;
    } catch {
      try { await this.redis.del(key); } catch { /* ignore del failure */ }
      return null;
    }
  }

  async setLoyalty(config: LoyaltyConfig): Promise<void> {
    await this.redis.set(this.loyaltyKey(), JSON.stringify(config), 'EX', this.ttlSec);
  }

  async invalidateLoyalty(): Promise<void> {
    await this.redis.del(this.loyaltyKey());
  }

  async getCustomOrderPolicy(): Promise<string | null | undefined> {
    const key = this.customOrderPolicyKey();
    try {
      const raw = await this.redis.get(key);
      if (raw === null) return undefined;
      return JSON.parse(raw) as string | null;
    } catch {
      try { await this.redis.del(key); } catch { /* ignore del failure */ }
      return undefined;
    }
  }

  async setCustomOrderPolicy(value: string | null): Promise<void> {
    await this.redis.set(this.customOrderPolicyKey(), JSON.stringify(value), 'EX', this.ttlSec);
  }

  async invalidateCustomOrderPolicy(): Promise<void> {
    await this.redis.del(this.customOrderPolicyKey());
  }

  async getReturnPolicy(): Promise<string | null | undefined> {
    const key = this.returnPolicyKey();
    try {
      const raw = await this.redis.get(key);
      if (raw === null) return undefined;
      return JSON.parse(raw) as string | null;
    } catch {
      try { await this.redis.del(key); } catch { /* ignore del failure */ }
      return undefined;
    }
  }

  async setReturnPolicy(value: string | null): Promise<void> {
    await this.redis.set(this.returnPolicyKey(), JSON.stringify(value), 'EX', this.ttlSec);
  }

  async invalidateReturnPolicy(): Promise<void> {
    await this.redis.del(this.returnPolicyKey());
  }

  async getNotificationPrefs(): Promise<NotificationPrefsConfig | undefined> {
    const key = this.notificationPrefsKey();
    try {
      const raw = await this.redis.get(key);
      if (raw === null) return undefined;
      const parsed: unknown = JSON.parse(raw);
      const result = NotificationPrefsSchema.safeParse(parsed);
      if (!result.success) {
        await this.redis.del(key);
        return undefined;
      }
      return result.data;
    } catch {
      try { await this.redis.del(key); } catch { /* ignore del failure */ }
      return undefined;
    }
  }

  async setNotificationPrefs(prefs: NotificationPrefsConfig): Promise<void> {
    await this.redis.set(this.notificationPrefsKey(), JSON.stringify(prefs), 'EX', this.ttlSec);
  }

  async invalidateNotificationPrefs(): Promise<void> {
    await this.redis.del(this.notificationPrefsKey());
  }

  private profileKey(): string {
    return `shop:${tenantContext.requireCurrent().shopId}:settings:profile`;
  }

  private makingChargesKey(): string {
    return `shop:${tenantContext.requireCurrent().shopId}:settings:making_charges`;
  }

  private wastageKey(): string {
    return `shop:${tenantContext.requireCurrent().shopId}:settings:wastage`;
  }

  private rateLockKey(): string {
    return `shop:${tenantContext.requireCurrent().shopId}:settings:rate_lock`;
  }

  private loyaltyKey(): string {
    return `shop:${tenantContext.requireCurrent().shopId}:settings:loyalty`;
  }

  private customOrderPolicyKey(): string {
    return `shop:${tenantContext.requireCurrent().shopId}:settings:custom_order_policy`;
  }

  private returnPolicyKey(): string {
    return `shop:${tenantContext.requireCurrent().shopId}:settings:return_policy`;
  }

  private notificationPrefsKey(): string {
    return `shop:${tenantContext.requireCurrent().shopId}:settings:notification_prefs`;
  }
}

 succeeded in 326ms:
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import { tenantContext } from '@goldsmith/tenant-context';
import type { ShopProfileRow, PatchShopProfileDto, AddressDto, OperatingHoursDto, MakingChargeConfig, WastageConfig, NotificationPrefsConfig, PatchNotificationPrefsDto } from '@goldsmith/shared';
import { LoyaltyConfig, LoyaltyConfigSchema, LOYALTY_DEFAULTS, WASTAGE_DEFAULTS, TRY_AT_HOME_DEFAULT_MAX_PIECES, NOTIFICATION_PREFS_DEFAULTS } from '@goldsmith/shared';
import type { UpdateProfileResult, UpdateMakingChargesResult, UpdateWastageResult, UpdateRateLockResult, UpdateTryAtHomeResult, UpdateCustomOrderPolicyResult, UpdateReturnPolicyResult, UpdateNotificationPrefsResult } from './settings.types';

interface ShopsRow {
  display_name: string;
  address_json: AddressDto | null;
  gstin: string | null;
  bis_registration: string | null;
  contact_phone: string | null;
  operating_hours_json: OperatingHoursDto | null;
  about_text: string | null;
  logo_url: string | null;
  years_in_business: number | null;
  updated_at: Date;
}

@Injectable()
export class SettingsRepository {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async getShopProfile(): Promise<ShopProfileRow> {
    return withTenantTx(this.pool, async (tx) => {
      const shopId = tenantContext.requireCurrent().shopId;
      const r = await tx.query<ShopsRow>(
        `SELECT display_name, address_json, gstin, bis_registration, contact_phone,
                operating_hours_json, about_text, logo_url, years_in_business, updated_at
           FROM shops WHERE id = $1`,
        [shopId],
      );
      if (r.rows.length === 0) throw new NotFoundException({ code: 'shop.not_found' });
      return this.mapRow(r.rows[0]);
    });
  }

  async updateShopProfile(patch: PatchShopProfileDto): Promise<UpdateProfileResult> {
    return withTenantTx(this.pool, async (tx) => {
      const shopId = tenantContext.requireCurrent().shopId;
      const before = await this.readProfileTx(tx);

      const { sets, params } = this.buildSetClause(patch);
      let after: ShopProfileRow;

      if (sets.length > 0) {
        params.push(shopId);
        const r = await tx.query<ShopsRow>(
          `UPDATE shops
              SET ${sets.join(', ')}, updated_at = now()
            WHERE id = $${params.length}
            RETURNING display_name, address_json, gstin, bis_registration, contact_phone,
                      operating_hours_json, about_text, logo_url, years_in_business, updated_at`,
          params,
        );
        after = this.mapRow(r.rows[0]);
      } else {
        after = before;
      }

      await tx.query(
        `INSERT INTO shop_settings (shop_id) VALUES ($1) ON CONFLICT (shop_id) DO NOTHING`,
        [shopId],
      );

      return { before, after };
    });
  }

  async getMakingCharges(): Promise<MakingChargeConfig[] | null> {
    return withTenantTx(this.pool, async (tx) => {
      const shopId = tenantContext.requireCurrent().shopId;
      const r = await tx.query<{ making_charges_json: MakingChargeConfig[] | null }>(
        `SELECT making_charges_json FROM shop_settings WHERE shop_id = $1`,
        [shopId],
      );
      if (r.rows.length === 0) return null;
      return r.rows[0].making_charges_json ?? null;
    });
  }

  async getWastage(): Promise<Record<string, string> | null> {
    return withTenantTx(this.pool, async (tx) => {
      const shopId = tenantContext.requireCurrent().shopId;
      const r = await tx.query<{ wastage_json: Record<string, string> | null }>(
        `SELECT wastage_json FROM shop_settings WHERE shop_id = $1`,
        [shopId],
      );
      if (r.rows.length === 0) return null;
      return r.rows[0].wastage_json ?? null;
    });
  }

  async upsertWastage(
    category: string,
    percent: string,
  ): Promise<UpdateWastageResult> {
    return withTenantTx(this.pool, async (tx) => {
      const shopId = tenantContext.requireCurrent().shopId;

      await tx.query(
        `INSERT INTO shop_settings (shop_id) VALUES ($1) ON CONFLICT (shop_id) DO NOTHING`,
        [shopId],
      );

      const beforeRow = await tx.query<{ wastage_json: Record<string, string> | null }>(
        `SELECT wastage_json FROM shop_settings WHERE shop_id = $1 FOR UPDATE`,
        [shopId],
      );
      const storedMap: Record<string, string> = beforeRow.rows[0]?.wastage_json ?? {};
      const before: WastageConfig[] | null = Object.keys(storedMap).length === 0
        ? null
        : WASTAGE_DEFAULTS.map((d) => ({ category: d.category, percent: storedMap[d.category] ?? d.percent }));

      const mergedMap = { ...storedMap, [category]: percent };

      const r = await tx.query<{ wastage_json: Record<string, string> }>(
        `INSERT INTO shop_settings (shop_id, wastage_json)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (shop_id)
         DO UPDATE SET wastage_json = $2::jsonb, updated_at = now()
         RETURNING wastage_json`,
        [shopId, JSON.stringify(mergedMap)],
      );
      const afterMap = r.rows[0].wastage_json;
      const after: WastageConfig[] = WASTAGE_DEFAULTS.map((d) => ({
        category: d.category,
        percent: afterMap[d.category] ?? d.percent,
      }));

      return { before, after };
    });
  }

  async getRateLockDays(): Promise<number | null> {
    return withTenantTx(this.pool, async (tx) => {
      const shopId = tenantContext.requireCurrent().shopId;
      const r = await tx.query<{ rate_lock_days: number | null }>(
        `SELECT rate_lock_days FROM shop_settings WHERE shop_id = $1`,
        [shopId],
      );
      return r.rows[0]?.rate_lock_days ?? null;
    });
  }

  async updateRateLockDays(days: number): Promise<UpdateRateLockResult> {
    return withTenantTx(this.pool, async (tx) => {
      const shopId = tenantContext.requireCurrent().shopId;

      // Ensure row exists so SELECT FOR UPDATE always acquires a lock.
      await tx.query(
        `INSERT INTO shop_settings (shop_id) VALUES ($1) ON CONFLICT (shop_id) DO NOTHING`,
        [shopId],
      );

      const beforeRow = await tx.query<{ rate_lock_days: number | null }>(
        `SELECT rate_lock_days FROM shop_settings WHERE shop_id = $1 FOR UPDATE`,
        [shopId],
      );
      const before = beforeRow.rows[0]?.rate_lock_days ?? null;

      const r = await tx.query<{ rate_lock_days: number }>(
        `UPDATE shop_settings
            SET rate_lock_days = $1, updated_at = now()
          WHERE shop_id = $2
          RETURNING rate_lock_days`,
        [days, shopId],
      );

      return { before, after: r.rows[0].rate_lock_days };
    });
  }

  async upsertMakingCharges(
    patchItems: MakingChargeConfig[],
    defaults: MakingChargeConfig[],
  ): Promise<UpdateMakingChargesResult> {
    return withTenantTx(this.pool, async (tx) => {
      const shopId = tenantContext.requireCurrent().shopId;

      await tx.query(
        `INSERT INTO shop_settings (shop_id) VALUES ($1) ON CONFLICT (shop_id) DO NOTHING`,
        [shopId],
      );

      const beforeRow = await tx.query<{ making_charges_json: MakingChargeConfig[] | null }>(
        `SELECT making_charges_json FROM shop_settings WHERE shop_id = $1 FOR UPDATE`,
        [shopId],
      );
      const before = beforeRow.rows.length > 0 ? (beforeRow.rows[0].making_charges_json ?? null) : null;

      const storedMap = before ? new Map(before.map((c) => [c.category, c])) : null;
      const current = storedMap ? defaults.map((d) => storedMap.get(d.category) ?? d) : defaults;
      const patchMap = new Map(patchItems.map((c) => [c.category, c]));
      const merged = current.map((c) => patchMap.get(c.category) ?? c);

      const r = await tx.query<{ making_charges_json: MakingChargeConfig[] }>(
        `INSERT INTO shop_settings (shop_id, making_charges_json)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (shop_id)
         DO UPDATE SET making_charges_json = $2::jsonb, updated_at = now()
         RETURNING making_charges_json`,
        [shopId, JSON.stringify(merged)],
      );
      const after = r.rows[0].making_charges_json;

      return { before, after };
    });
  }

  async getLoyalty(): Promise<LoyaltyConfig> {
    return withTenantTx(this.pool, async (tx) => {
      const { shopId } = tenantContext.requireCurrent();
      const r = await tx.query<{ loyalty_json: unknown }>(
        `SELECT loyalty_json FROM shop_settings WHERE shop_id = $1`,
        [shopId],
      );
      if (r.rows.length === 0 || r.rows[0].loyalty_json == null) {
        return LOYALTY_DEFAULTS;
      }
      const parsed = LoyaltyConfigSchema.safeParse(r.rows[0].loyalty_json);
      return parsed.success ? parsed.data : LOYALTY_DEFAULTS;
    });
  }

  async upsertLoyalty(config: LoyaltyConfig): Promise<void> {
    return withTenantTx(this.pool, async (tx) => {
      const { shopId } = tenantContext.requireCurrent();
      await tx.query(
        `INSERT INTO shop_settings (shop_id, loyalty_json)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (shop_id) DO UPDATE SET loyalty_json = EXCLUDED.loyalty_json, updated_at = now()`,
        [shopId, JSON.stringify(config)],
      );
    });
  }

  async getTryAtHome(): Promise<{ enabled: boolean; maxPieces: number | null }> {
    return withTenantTx(this.pool, async (tx) => {
      const shopId = tenantContext.requireCurrent().shopId;
      const r = await tx.query<{ try_at_home_enabled: boolean; try_at_home_max_pieces: number | null }>(
        `SELECT try_at_home_enabled, try_at_home_max_pieces FROM shop_settings WHERE shop_id = $1`,
        [shopId],
      );
      return {
        enabled: r.rows[0]?.try_at_home_enabled ?? false,
        maxPieces: r.rows[0]?.try_at_home_max_pieces ?? null,
      };
    });
  }

  async updateTryAtHome(enabled: boolean, maxPieces: number): Promise<UpdateTryAtHomeResult> {
    return withTenantTx(this.pool, async (tx) => {
      const shopId = tenantContext.requireCurrent().shopId;

      await tx.query(
        `INSERT INTO shop_settings (shop_id) VALUES ($1) ON CONFLICT (shop_id) DO NOTHING`,
        [shopId],
      );

      const beforeRow = await tx.query<{ try_at_home_enabled: boolean; try_at_home_max_pieces: number | null }>(
        `SELECT try_at_home_enabled, try_at_home_max_pieces FROM shop_settings WHERE shop_id = $1 FOR UPDATE`,
        [shopId],
      );
      const before = {
        tryAtHomeEnabled: beforeRow.rows[0].try_at_home_enabled,
        tryAtHomeMaxPieces: beforeRow.rows[0].try_at_home_max_pieces ?? TRY_AT_HOME_DEFAULT_MAX_PIECES,
      };

      const r = await tx.query<{ try_at_home_enabled: boolean; try_at_home_max_pieces: number }>(
        `UPDATE shop_settings
            SET try_at_home_enabled = $1, try_at_home_max_pieces = $2, updated_at = now()
          WHERE shop_id = $3
          RETURNING try_at_home_enabled, try_at_home_max_pieces`,
        [enabled, maxPieces, shopId],
      );

      return {
        before,
        after: {
          tryAtHomeEnabled: r.rows[0].try_at_home_enabled,
          tryAtHomeMaxPieces: r.rows[0].try_at_home_max_pieces,
        },
      };
    });
  }

  async getCustomOrderPolicy(): Promise<string | null> {
    return withTenantTx(this.pool, async (tx) => {
      const shopId = tenantContext.requireCurrent().shopId;
      const r = await tx.query<{ custom_order_policy_text: string | null }>(
        `SELECT custom_order_policy_text FROM shop_settings WHERE shop_id = $1`,
        [shopId],
      );
      return r.rows[0]?.custom_order_policy_text ?? null;
    });
  }

  async updateCustomOrderPolicy(text: string): Promise<UpdateCustomOrderPolicyResult> {
    return withTenantTx(this.pool, async (tx) => {
      const shopId = tenantContext.requireCurrent().shopId;

      await tx.query(
        `INSERT INTO shop_settings (shop_id) VALUES ($1) ON CONFLICT (shop_id) DO NOTHING`,
        [shopId],
      );

      const beforeRow = await tx.query<{ custom_order_policy_text: string | null }>(
        `SELECT custom_order_policy_text FROM shop_settings WHERE shop_id = $1 FOR UPDATE`,
        [shopId],
      );
      const before = beforeRow.rows[0]?.custom_order_policy_text ?? null;

      const r = await tx.query<{ custom_order_policy_text: string | null }>(
        `UPDATE shop_settings
            SET custom_order_policy_text = $1, updated_at = now()
          WHERE shop_id = $2
          RETURNING custom_order_policy_text`,
        [text || null, shopId],
      );

      return { before, after: r.rows[0].custom_order_policy_text };
    });
  }

  async getReturnPolicy(): Promise<string | null> {
    return withTenantTx(this.pool, async (tx) => {
      const shopId = tenantContext.requireCurrent().shopId;
      const r = await tx.query<{ return_policy_text: string | null }>(
        `SELECT return_policy_text FROM shop_settings WHERE shop_id = $1`,
        [shopId],
      );
      return r.rows[0]?.return_policy_text ?? null;
    });
  }

  async updateReturnPolicy(text: string): Promise<UpdateReturnPolicyResult> {
    return withTenantTx(this.pool, async (tx) => {
      const shopId = tenantContext.requireCurrent().shopId;

      await tx.query(
        `INSERT INTO shop_settings (shop_id) VALUES ($1) ON CONFLICT (shop_id) DO NOTHING`,
        [shopId],
      );

      const beforeRow = await tx.query<{ return_policy_text: string | null }>(
        `SELECT return_policy_text FROM shop_settings WHERE shop_id = $1 FOR UPDATE`,
        [shopId],
      );
      const before = beforeRow.rows[0]?.return_policy_text ?? null;

      const r = await tx.query<{ return_policy_text: string | null }>(
        `UPDATE shop_settings
            SET return_policy_text = $1, updated_at = now()
          WHERE shop_id = $2
          RETURNING return_policy_text`,
        [text || null, shopId],
      );

      return { before, after: r.rows[0].return_policy_text };
    });
  }

  async getNotificationPrefs(): Promise<NotificationPrefsConfig | null> {
    return withTenantTx(this.pool, async (tx) => {
      const shopId = tenantContext.requireCurrent().shopId;
      const r = await tx.query<{ notification_prefs_json: NotificationPrefsConfig | null }>(
        `SELECT notification_prefs_json FROM shop_settings WHERE shop_id = $1`,
        [shopId],
      );
      return r.rows[0]?.notification_prefs_json ?? null;
    });
  }

  // Accepts a partial patch and merges it against the current DB row inside
  // a single FOR UPDATE transaction so concurrent partial patches on different
  // keys are serialised and never lose each other's changes.
  async updateNotificationPrefs(patch: PatchNotificationPrefsDto): Promise<UpdateNotificationPrefsResult> {
    return withTenantTx(this.pool, async (tx) => {
      const shopId = tenantContext.requireCurrent().shopId;

      await tx.query(
        `INSERT INTO shop_settings (shop_id) VALUES ($1) ON CONFLICT (shop_id) DO NOTHING`,
        [shopId],
      );

      // Lock the row so concurrent partial PATCHes are serialised.
      const beforeRow = await tx.query<{ notification_prefs_json: NotificationPrefsConfig | null }>(
        `SELECT notification_prefs_json FROM shop_settings WHERE shop_id = $1 FOR UPDATE`,
        [shopId],
      );
      const before = beforeRow.rows[0]?.notification_prefs_json ?? null;
      const existing = before ?? NOTIFICATION_PREFS_DEFAULTS;

      // Merge the partial patch against the locked current value.
      const merged: NotificationPrefsConfig = {
        orderUpdates:    patch.orderUpdates    ? { ...existing.orderUpdates,    ...patch.orderUpdates    } : existing.orderUpdates,
        loyaltyUpdates:  patch.loyaltyUpdates  ? { ...existing.loyaltyUpdates,  ...patch.loyaltyUpdates  } : existing.loyaltyUpdates,
        rateAlerts:      patch.rateAlerts      ? { ...existing.rateAlerts,      ...patch.rateAlerts      } : existing.rateAlerts,
        staffActivity:   patch.staffActivity   ? { ...existing.staffActivity,   ...patch.staffActivity   } : existing.staffActivity,
        paymentReceipts: patch.paymentReceipts ? { ...existing.paymentReceipts, ...patch.paymentReceipts } : existing.paymentReceipts,
      };

      const r = await tx.query<{ notification_prefs_json: NotificationPrefsConfig }>(
        `INSERT INTO shop_settings (shop_id, notification_prefs_json)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (shop_id)
         DO UPDATE SET notification_prefs_json = EXCLUDED.notification_prefs_json, updated_at = now()
         RETURNING notification_prefs_json`,
        [shopId, JSON.stringify(merged)],
      );

      return { before, after: r.rows[0].notification_prefs_json };
    });
  }

  private async readProfileTx(tx: PoolClient): Promise<ShopProfileRow> {
    const shopId = tenantContext.requireCurrent().shopId;
    const r = await tx.query<ShopsRow>(
      `SELECT display_name, address_json, gstin, bis_registration, contact_phone,
              operating_hours_json, about_text, logo_url, years_in_business, updated_at
         FROM shops WHERE id = $1`,
      [shopId],
    );
    if (r.rows.length === 0) throw new NotFoundException({ code: 'shop.not_found' });
    return this.mapRow(r.rows[0]);
  }

  private buildSetClause(patch: PatchShopProfileDto): { sets: string[]; params: unknown[] } {
    const sets: string[] = [];
    const params: unknown[] = [];

    const push = (col: string, val: unknown): void => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };

    if (patch.name !== undefined)             push('display_name', patch.name);
    if ('address' in patch)                   push('address_json', patch.address ? JSON.stringify(patch.address) : null);
    if ('gstin' in patch)                     push('gstin', patch.gstin);
    if ('bis_registration' in patch)          push('bis_registration', patch.bis_registration);
    if ('contact_phone' in patch)             push('contact_phone', patch.contact_phone);
    if ('operating_hours' in patch)           push('operating_hours_json', patch.operating_hours ? JSON.stringify(patch.operating_hours) : null);
    if ('about_text' in patch)                push('about_text', patch.about_text);
    if ('logo_url' in patch)                  push('logo_url', patch.logo_url);
    if ('years_in_business' in patch)         push('years_in_business', patch.years_in_business);

    return { sets, params };
  }

  private mapRow(row: ShopsRow): ShopProfileRow {
    return {
      name:              row.display_name,
      address:           row.address_json,
      gstin:             row.gstin,
      bis_registration:  row.bis_registration,
      contact_phone:     row.contact_phone,
      operating_hours:   row.operating_hours_json,
      about_text:        row.about_text,
      logo_url:          row.logo_url,
      years_in_business: row.years_in_business,
      updated_at:        row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }
}

 succeeded in 316ms:
import { BadRequestException, Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import type { Pool } from 'pg';
import {
  PatchShopProfileSchema, LoyaltyConfig, LoyaltyConfigSchema, PatchLoyaltyDto,
  PatchMakingChargesSchema, MAKING_CHARGE_DEFAULTS, PatchWastageSchema, WASTAGE_DEFAULTS,
  PatchRateLockSchema, RATE_LOCK_DEFAULT_DAYS,
  PatchTryAtHomeSchema, TRY_AT_HOME_DEFAULT_MAX_PIECES,
  PatchCustomOrderPolicySchema, PatchReturnPolicySchema,
  PatchNotificationPrefsSchema, NOTIFICATION_PREFS_DEFAULTS,
} from '@goldsmith/shared';
import type {
  PatchShopProfileDto, ShopProfileRow, MakingChargeConfig, PatchMakingChargesDto,
  WastageConfig, PatchWastageDto, PatchRateLockDto, PatchTryAtHomeDto, TryAtHomeRow,
  PatchCustomOrderPolicyDto, PatchReturnPolicyDto, PatchNotificationPrefsDto, NotificationPrefsConfig,
} from '@goldsmith/shared';
import { auditLog, AuditAction } from '@goldsmith/audit';
import { tenantContext } from '@goldsmith/tenant-context';
import { SettingsCache, FeatureFlagsCache } from '@goldsmith/tenant-config';
import type { FeatureFlags } from '@goldsmith/tenant-config';
import { SettingsRepository } from './settings.repository';
import { DrizzleTenantLookup } from '../../drizzle-tenant-lookup';
import type { UpdateLoyaltyResult } from './settings.types';

@Injectable()
export class SettingsService {
  constructor(
    @Inject(SettingsRepository)  private readonly repo: SettingsRepository,
    @Inject(SettingsCache)       private readonly cache: SettingsCache,
    @Inject(FeatureFlagsCache)   private readonly flagsCache: FeatureFlagsCache,
    @Inject(DrizzleTenantLookup) private readonly tenantLookup: DrizzleTenantLookup,
    @Inject('PG_POOL')           private readonly pool: Pool,
  ) {}

  async getProfile(): Promise<ShopProfileRow> {
    const hit = await this.cache.getProfile();
    if (hit) return hit;
    const profile = await this.repo.getShopProfile();
    await this.cache.setProfile(profile);
    return profile;
  }

  async updateProfile(dto: PatchShopProfileDto): Promise<ShopProfileRow> {
    const parsed = PatchShopProfileSchema.safeParse(dto);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ field: i.path.join('.'), code: i.message }));
      throw new BadRequestException({ code: 'validation.failed', errors });
    }

    const { before, after } = await this.repo.updateShopProfile(parsed.data);

    await this.cache.invalidate();

    const shopId = tenantContext.requireCurrent().shopId;
    this.tenantLookup.invalidate(shopId);

    void this.auditProfileUpdate(before, after).catch(() => undefined);

    return after;
  }

  async getLoyalty(): Promise<LoyaltyConfig> {
    const hit = await this.cache.getLoyalty();
    if (hit) return hit;
    const config = await this.repo.getLoyalty();
    await this.cache.setLoyalty(config);
    return config;
  }

  async updateLoyalty(dto: PatchLoyaltyDto): Promise<UpdateLoyaltyResult> {
    const current = await this.getLoyalty();
    const newConfig: LoyaltyConfig = {
      ...current,
      tiers: [...current.tiers] as LoyaltyConfig['tiers'],
    };

    if (dto.type === 'tier') {
      const thresholdPaise = SettingsService.rupeesToPaise(dto.thresholdRupees);
      newConfig.tiers = [
        { ...newConfig.tiers[0] },
        { ...newConfig.tiers[1] },
        { ...newConfig.tiers[2] },
      ] as LoyaltyConfig['tiers'];
      newConfig.tiers[dto.index] = {
        name: dto.name,
        thresholdPaise,
        badgeColor: dto.badgeColor,
      };
    } else {
      // type === 'rate'
      newConfig.earnRatePercentage = dto.earnRatePercentage;
      newConfig.redemptionRatePercentage = dto.redemptionRatePercentage;
    }

    // Enforce strict ascending tier order on both branches
    if (!SettingsService.isAscendingOrder(newConfig.tiers)) {
      return { ok: false, error: 'TIER_ORDER_INVALID' };
    }

    const parsed = LoyaltyConfigSchema.safeParse(newConfig);
    if (!parsed.success) {
      return { ok: false, error: 'SCHEMA_INVALID' };
    }

    await this.repo.upsertLoyalty(parsed.data);
    await this.cache.invalidateLoyalty();

    const { shopId } = tenantContext.requireCurrent();
    void auditLog(this.pool, {
      action: AuditAction.SETTINGS_LOYALTY_UPDATED,
      subjectType: 'shop',
      subjectId: shopId,
      metadata: { type: dto.type, before: current, after: parsed.data },
    }).catch(() => undefined);

    return { ok: true, config: parsed.data };
  }

  async getCustomOrderPolicy(): Promise<string | null> {
    const hit = await this.cache.getCustomOrderPolicy();
    if (hit !== undefined) return hit;
    const stored = await this.repo.getCustomOrderPolicy();
    await this.cache.setCustomOrderPolicy(stored);
    return stored;
  }

  async updateCustomOrderPolicy(dto: PatchCustomOrderPolicyDto): Promise<string | null> {
    const parsed = PatchCustomOrderPolicySchema.safeParse(dto);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ field: i.path.join('.'), code: i.message }));
      throw new UnprocessableEntityException({ code: 'validation.failed', errors });
    }
    const { before, after } = await this.repo.updateCustomOrderPolicy(parsed.data.customOrderPolicyText);
    await this.cache.invalidateCustomOrderPolicy();
    void this.auditPolicyUpdate(AuditAction.SETTINGS_CUSTOM_ORDER_POLICY_UPDATED, before, after).catch(() => undefined);
    return after;
  }

  async getReturnPolicy(): Promise<string | null> {
    const hit = await this.cache.getReturnPolicy();
    if (hit !== undefined) return hit;
    const stored = await this.repo.getReturnPolicy();
    await this.cache.setReturnPolicy(stored);
    return stored;
  }

  async updateReturnPolicy(dto: PatchReturnPolicyDto): Promise<string | null> {
    const parsed = PatchReturnPolicySchema.safeParse(dto);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ field: i.path.join('.'), code: i.message }));
      throw new UnprocessableEntityException({ code: 'validation.failed', errors });
    }
    const { before, after } = await this.repo.updateReturnPolicy(parsed.data.returnPolicyText);
    await this.cache.invalidateReturnPolicy();
    void this.auditPolicyUpdate(AuditAction.SETTINGS_RETURN_POLICY_UPDATED, before, after).catch(() => undefined);
    return after;
  }

  async getNotificationPrefs(): Promise<NotificationPrefsConfig> {
    const hit = await this.cache.getNotificationPrefs();
    if (hit !== undefined) return hit;
    const stored = await this.repo.getNotificationPrefs();
    const prefs = stored ?? NOTIFICATION_PREFS_DEFAULTS;
    await this.cache.setNotificationPrefs(prefs);
    return prefs;
  }

  async updateNotificationPrefs(dto: PatchNotificationPrefsDto): Promise<NotificationPrefsConfig> {
    const parsed = PatchNotificationPrefsSchema.safeParse(dto);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ field: i.path.join('.'), code: i.message }));
      throw new UnprocessableEntityException({ code: 'validation.failed', errors });
    }
    // Merge happens inside the repo transaction against a FOR UPDATE-locked row,
    // so concurrent partial PATCHes on different keys never lose each other's changes.
    const { before, after } = await this.repo.updateNotificationPrefs(parsed.data);
    await this.cache.invalidateNotificationPrefs();
    void this.auditNotificationPrefsUpdate(before, after).catch(() => undefined);
    return after;
  }

  private async auditPolicyUpdate(
    action: AuditAction,
    before: string | null,
    after: string | null,
  ): Promise<void> {
    const tc = tenantContext.current();
    if (!tc) return;
    await auditLog(this.pool, {
      action,
      subjectType: 'shop',
      subjectId: tc.shopId,
      actorUserId: tc.authenticated ? tc.userId : undefined,
      before,
      after,
    });
  }

  private async auditNotificationPrefsUpdate(
    before: NotificationPrefsConfig | null,
    after: NotificationPrefsConfig,
  ): Promise<void> {
    const tc = tenantContext.current();
    if (!tc) return;
    await auditLog(this.pool, {
      action: AuditAction.SETTINGS_NOTIFICATION_PREFS_UPDATED,
      subjectType: 'shop',
      subjectId: tc.shopId,
      actorUserId: tc.authenticated ? tc.userId : undefined,
      before,
      after,
    });
  }

  private static rupeesToPaise(rupees: string): number {
    if (!/^\d+(\.\d{1,2})?$/.test(rupees)) {
      throw new UnprocessableEntityException({ code: 'settings.threshold_out_of_range' });
    }
    const [whole = '0', frac = ''] = rupees.split('.');
    const wholePaise = parseInt(whole, 10) * 100;
    const fracPaise = parseInt(frac.slice(0, 2).padEnd(2, '0'), 10);
    const paise = wholePaise + fracPaise;
    if (!Number.isFinite(paise) || paise < 0 || paise > 1_000_000_000) {
      throw new UnprocessableEntityException({ code: 'settings.threshold_out_of_range' });
    }
    return paise;
  }

  private static isAscendingOrder(tiers: LoyaltyConfig['tiers']): boolean {
    return tiers[0].thresholdPaise < tiers[1].thresholdPaise &&
           tiers[1].thresholdPaise < tiers[2].thresholdPaise;
  }

  private async auditProfileUpdate(
    before: ShopProfileRow,
    after: ShopProfileRow,
  ): Promise<void> {
    const tc = tenantContext.current();
    if (!tc) return;
    await auditLog(this.pool, {
      action: AuditAction.SETTINGS_PROFILE_UPDATED,
      subjectType: 'shop',
      subjectId: tc.shopId,
      actorUserId: tc.authenticated ? tc.userId : undefined,
      before,
      after,
    });
  }

  async getMakingCharges(): Promise<MakingChargeConfig[]> {
    const hit = await this.cache.getMakingCharges();
    if (hit) return hit;
    const stored = await this.repo.getMakingCharges();
    let configs: MakingChargeConfig[];
    if (!stored) {
      configs = MAKING_CHARGE_DEFAULTS;
    } else {
      const storedMap = new Map(stored.map((c) => [c.category, c]));
      configs = MAKING_CHARGE_DEFAULTS.map((d) => storedMap.get(d.category) ?? d);
    }
    await this.cache.setMakingCharges(configs);
    return configs;
  }

  async updateMakingCharges(dto: PatchMakingChargesDto): Promise<MakingChargeConfig[]> {
    const parsed = PatchMakingChargesSchema.safeParse(dto);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ field: i.path.join('.'), code: i.message }));
      throw new BadRequestException({ code: 'validation.failed', errors });
    }

    const { before, after } = await this.repo.upsertMakingCharges(parsed.data, MAKING_CHARGE_DEFAULTS);

    await this.cache.invalidateMakingCharges();

    void this.auditMakingChargesUpdate(before, after).catch(() => undefined);

    return after;
  }

  private async auditMakingChargesUpdate(
    before: MakingChargeConfig[] | null,
    after: MakingChargeConfig[],
  ): Promise<void> {
    const tc = tenantContext.current();
    if (!tc) return;
    await auditLog(this.pool, {
      action: AuditAction.SETTINGS_MAKING_CHARGES_UPDATED,
      subjectType: 'shop',
      subjectId: tc.shopId,
      actorUserId: tc.authenticated ? tc.userId : undefined,
      before,
      after,
    });
  }

  async getWastage(): Promise<WastageConfig[]> {
    const hit = await this.cache.getWastage();
    if (hit) return hit;
    const storedMap = await this.repo.getWastage();
    const configs: WastageConfig[] = storedMap === null
      ? WASTAGE_DEFAULTS
      : WASTAGE_DEFAULTS.map((d) => ({ category: d.category, percent: storedMap[d.category] ?? d.percent }));
    await this.cache.setWastage(configs);
    return configs;
  }

  async updateWastage(dto: PatchWastageDto): Promise<WastageConfig[]> {
    const parsed = PatchWastageSchema.safeParse(dto);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ field: i.path.join('.'), code: i.message }));
      throw new BadRequestException({ code: 'validation.failed', errors });
    }

    if (parseFloat(parsed.data.percent) > 30) {
      throw new UnprocessableEntityException({
        code: 'settings.wastage_high',
        message: 'à¤˜à¤Ÿà¤¤ 30% à¤¸à¥‡ à¤œà¤¼à¥à¤¯à¤¾à¤¦à¤¾ à¤¨à¤¹à¥€à¤‚ à¤¹à¥‹à¤¨à¥€ à¤šà¤¾à¤¹à¤¿à¤',
      });
    }

    const { before, after } = await this.repo.upsertWastage(
      parsed.data.category,
      parsed.data.percent,
    );

    await this.cache.invalidateWastage();

    void this.auditWastageUpdate(before, after).catch(() => undefined);

    return after;
  }

  private async auditWastageUpdate(
    before: WastageConfig[] | null,
    after: WastageConfig[],
  ): Promise<void> {
    const tc = tenantContext.current();
    if (!tc) return;
    await auditLog(this.pool, {
      action: AuditAction.SETTINGS_WASTAGE_UPDATED,
      subjectType: 'shop',
      subjectId: tc.shopId,
      actorUserId: tc.authenticated ? tc.userId : undefined,
      before,
      after,
    });
  }

  async getRateLock(): Promise<number> {
    const hit = await this.cache.getRateLock();
    if (hit !== null) return hit;
    const stored = await this.repo.getRateLockDays();
    const days = stored ?? RATE_LOCK_DEFAULT_DAYS;
    await this.cache.setRateLock(days);
    return days;
  }

  async updateRateLock(dto: PatchRateLockDto): Promise<number> {
    const parsed = PatchRateLockSchema.safeParse(dto);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ field: i.path.join('.'), code: i.message }));
      throw new UnprocessableEntityException({ code: 'validation.failed', errors });
    }

    const { before, after } = await this.repo.updateRateLockDays(parsed.data.rateLockDays);
    await this.cache.invalidateRateLock();
    void this.auditRateLockUpdate(before, after).catch(() => undefined);
    return after;
  }

  private async auditRateLockUpdate(
    before: number | null,
    after: number,
  ): Promise<void> {
    const tc = tenantContext.current();
    if (!tc) return;
    await auditLog(this.pool, {
      action: AuditAction.SETTINGS_RATE_LOCK_UPDATED,
      subjectType: 'shop',
      subjectId: tc.shopId,
      actorUserId: tc.authenticated ? tc.userId : undefined,
      before,
      after,
    });
  }

  async getTryAtHome(): Promise<TryAtHomeRow> {
    const { enabled, maxPieces } = await this.repo.getTryAtHome();
    return {
      tryAtHomeEnabled: enabled,
      tryAtHomeMaxPieces: maxPieces ?? TRY_AT_HOME_DEFAULT_MAX_PIECES,
    };
  }

  async updateTryAtHome(dto: PatchTryAtHomeDto): Promise<TryAtHomeRow> {
    const parsed = PatchTryAtHomeSchema.safeParse(dto);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ field: i.path.join('.'), code: i.message }));
      throw new UnprocessableEntityException({ code: 'validation.failed', errors });
    }

    const current = await this.repo.getTryAtHome();
    const currentMaxPieces = current.maxPieces ?? TRY_AT_HOME_DEFAULT_MAX_PIECES;
    const nextEnabled = parsed.data.tryAtHomeEnabled ?? current.enabled;
    // "If tryAtHomeEnabled=false in the request â†’ ignore tryAtHomeMaxPieces"
    const nextMaxPieces = parsed.data.tryAtHomeEnabled === false
      ? currentMaxPieces
      : (parsed.data.tryAtHomeMaxPieces ?? currentMaxPieces);

    const { before, after } = await this.repo.updateTryAtHome(nextEnabled, nextMaxPieces);

    const { shopId } = tenantContext.requireCurrent();
    await this.flagsCache.invalidate(shopId);

    void this.auditTryAtHomeUpdate(before, after).catch(() => undefined);

    return after;
  }

  async getFeatureFlags(): Promise<FeatureFlags> {
    const { shopId } = tenantContext.requireCurrent();
    const hit = await this.flagsCache.getFlags(shopId);
    if (hit) return hit;
    const { enabled, maxPieces } = await this.repo.getTryAtHome();
    const flags: FeatureFlags = {
      try_at_home: enabled,
      max_pieces: maxPieces ?? TRY_AT_HOME_DEFAULT_MAX_PIECES,
    };
    await this.flagsCache.setFlags(shopId, flags);
    return flags;
  }

  private async auditTryAtHomeUpdate(
    before: TryAtHomeRow,
    after: TryAtHomeRow,
  ): Promise<void> {
    const tc = tenantContext.current();
    if (!tc) return;
    await auditLog(this.pool, {
      action: AuditAction.SETTINGS_TRY_AT_HOME_UPDATED,
      subjectType: 'shop',
      subjectId: tc.shopId,
      actorUserId: tc.authenticated ? tc.userId : undefined,
      before,
      after,
    });
  }
}

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content 'packages/crypto-envelope/src/local-kms.ts'" in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content 'packages/crypto-envelope/src/kms-adapter.ts'" in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content 'packages/crypto-envelope/src/envelope.ts'" in C:\Alok\Business Projects\Goldsmith
 succeeded in 219ms:
export interface EncryptedDek {
  encryptedDek: Buffer;
  keyArn: string;
}

export interface KmsAdapter {
  createKeyForTenant(tenantId: string): Promise<string>;
  generateDataKey(keyArn: string): Promise<{ plaintext: Buffer; encryptedDek: Buffer }>;
  decryptDataKey(encryptedDek: Buffer, keyArn: string): Promise<Buffer>;
  scheduleKeyDeletion(keyArn: string, pendingDays?: number): Promise<void>;
}

 succeeded in 219ms:
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import type { KmsAdapter } from './kms-adapter';

interface StoredKey { keyMaterial: Buffer; deleted: boolean; }

export class LocalKMS implements KmsAdapter {
  private keys = new Map<string, StoredKey>();

  async createKeyForTenant(tenantId: string): Promise<string> {
    const arn = `local:kms:${tenantId}:${randomBytes(8).toString('hex')}`;
    this.keys.set(arn, { keyMaterial: randomBytes(32), deleted: false });
    return arn;
  }

  async generateDataKey(keyArn: string): Promise<{ plaintext: Buffer; encryptedDek: Buffer }> {
    const kek = this.keys.get(keyArn);
    if (!kek || kek.deleted) throw new Error('key.unavailable');
    const plaintext = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', kek.keyMaterial, iv);
    const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { plaintext, encryptedDek: Buffer.concat([iv, tag, ct]) };
  }

  async decryptDataKey(encryptedDek: Buffer, keyArn: string): Promise<Buffer> {
    const kek = this.keys.get(keyArn);
    if (!kek || kek.deleted) throw new Error('key.unavailable');
    const iv = encryptedDek.subarray(0, 12);
    const tag = encryptedDek.subarray(12, 28);
    const ct = encryptedDek.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', kek.keyMaterial, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  }

  async scheduleKeyDeletion(keyArn: string): Promise<void> {
    const k = this.keys.get(keyArn);
    if (k) k.deleted = true;
  }
}

 succeeded in 200ms:
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import type { KmsAdapter } from './kms-adapter';

export interface EnvelopeCiphertext {
  ciphertext: Buffer;
  encryptedDek: Buffer;
  iv: Buffer;
  tag: Buffer;
  keyArn: string;
}

export async function encryptColumn(
  kms: KmsAdapter,
  keyArn: string,
  plaintext: string,
): Promise<EnvelopeCiphertext> {
  const { plaintext: dek, encryptedDek } = await kms.generateDataKey(keyArn);
  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', dek, iv);
    const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { ciphertext, encryptedDek, iv, tag, keyArn };
  } finally {
    dek.fill(0);
  }
}

export async function decryptColumn(kms: KmsAdapter, payload: EnvelopeCiphertext): Promise<string> {
  const dek = await kms.decryptDataKey(payload.encryptedDek, payload.keyArn);
  try {
    const decipher = createDecipheriv('aes-256-gcm', dek, payload.iv);
    decipher.setAuthTag(payload.tag);
    const plain = Buffer.concat([decipher.update(payload.ciphertext), decipher.final()]);
    try {
      return plain.toString('utf8');
    } finally {
      plain.fill(0);
    }
  } finally {
    dek.fill(0);
  }
}

2026-04-25T20:38:58.717339Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -Recurse -File apps/api/src,packages | Select-String -Pattern 'ComplianceHardBlockError|compliance\\.'"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -Recurse -File apps/api/src,packages | Select-String -Pattern 'ComplianceHardBlockError|compliance\\.'" in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -Recurse -File apps/api/src,packages | Select-String -Pattern 'ComplianceHardBlockError|compliance\\.'"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "setPendingDto" apps/shopkeeper/app/billing/new.tsx' in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"ComplianceHardBlockError|compliance\\\\.\" apps/api/src packages" in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "LocalKMS|KMS_ADAPTER|new LocalKMS" apps/api/src/modules/billing/billing.module.ts apps/api/src/modules/billing/billing.service.ts packages/crypto-envelope/src/local-kms.ts scripts packages/db/src/schema/shops.ts' in C:\Alok\Business Projects\Goldsmith
 succeeded in 195ms:
122:    setPendingDto(null);

 succeeded in 218ms:
apps/api/src\modules\billing\billing.service.ts:14:  ComplianceHardBlockError,
apps/api/src\modules\billing\billing.service.ts:42:export { ComplianceHardBlockError };
apps/api/src\modules\billing\billing.service.spec.ts:5:import { ComplianceHardBlockError } from '@goldsmith/compliance';
apps/api/src\modules\billing\billing.service.spec.ts:139:    ).rejects.toBeInstanceOf(ComplianceHardBlockError);
apps/api/src\modules\billing\billing.service.spec.ts:191:    ).rejects.toBeInstanceOf(ComplianceHardBlockError);
packages\compliance\src\pan\rule-114b.ts:1:import { ComplianceHardBlockError } from '../errors';
packages\compliance\src\pan\rule-114b.ts:17:  throw new ComplianceHardBlockError('compliance.pan_required', {
packages\compliance\src\pan\rule-114b.ts:36:    throw new ComplianceHardBlockError('compliance.form60_incomplete', { missingFields: missing });
packages\compliance\src\pan\rule-114b.test.ts:3:import { ComplianceHardBlockError } from '../errors';
packages\compliance\src\pan\rule-114b.test.ts:29:    ).toThrow(ComplianceHardBlockError);
packages\compliance\src\pan\rule-114b.test.ts:35:    ).toThrow(ComplianceHardBlockError);
packages\compliance\src\pan\rule-114b.test.ts:43:      expect((e as ComplianceHardBlockError).code).toBe('compliance.pan_required');
packages\compliance\src\pan\rule-114b.test.ts:44:      expect((e as ComplianceHardBlockError).meta.thresholdPaise).toBe(THRESHOLD.toString());
packages\compliance\src\pan\rule-114b.test.ts:67:    ).toThrow(ComplianceHardBlockError);
packages\compliance\src\pan\rule-114b.test.ts:91:    expect(() => validateForm60(bad)).toThrow(ComplianceHardBlockError);
packages\compliance\src\pan\rule-114b.test.ts:95:      expect((e as ComplianceHardBlockError).code).toBe('compliance.form60_incomplete');
packages\compliance\src\pan\rule-114b.test.ts:96:      expect((e as ComplianceHardBlockError).meta.missingFields).toContain('name');
packages\compliance\src\pan\rule-114b.test.ts:102:    expect(() => validateForm60(bad)).toThrow(ComplianceHardBlockError);
packages\compliance\src\pan\rule-114b.test.ts:107:    expect(() => validateForm60(bad)).toThrow(ComplianceHardBlockError);
packages\compliance\src\pan\rule-114b.test.ts:112:    expect(() => validateForm60(bad)).toThrow(ComplianceHardBlockError);
packages\compliance\src\pan\rule-114b.test.ts:119:      const missing = (e as ComplianceHardBlockError).meta.missingFields as string[];
packages\compliance\src\errors.ts:9:export class ComplianceHardBlockError extends Error {
packages\compliance\src\errors.ts:15:    this.name = 'ComplianceHardBlockError';
packages\compliance\src\errors.ts:17:    Object.setPrototypeOf(this, ComplianceHardBlockError.prototype);
packages\compliance\src\index.ts:5:export { ComplianceHardBlockError } from './errors';
packages\compliance\src\errors.test.ts:2:import { ComplianceHardBlockError } from './errors';
packages\compliance\src\errors.test.ts:4:describe('ComplianceHardBlockError', () => {
packages\compliance\src\errors.test.ts:6:    const err = new ComplianceHardBlockError('compliance.huid_missing', { lineIndex: 2 });
packages\compliance\src\errors.test.ts:9:    expect(err.name).toBe('ComplianceHardBlockError');
packages\compliance\src\errors.test.ts:15:      throw new ComplianceHardBlockError('x.y');
packages\compliance\src\errors.test.ts:17:      expect(e).toBeInstanceOf(ComplianceHardBlockError);
packages\compliance\src\huid\validate-presence.test.ts:3:import { ComplianceHardBlockError } from '../errors';
packages\compliance\src\huid\validate-presence.test.ts:28:    ).toThrow(ComplianceHardBlockError);
packages\compliance\src\huid\validate-presence.test.ts:34:      expect((e as ComplianceHardBlockError).code).toBe('compliance.huid_missing');
packages\compliance\src\huid\validate-presence.test.ts:35:      expect((e as ComplianceHardBlockError).meta).toEqual({ lineIndex: 2 });
packages\compliance\src\huid\validate-presence.test.ts:44:    ).toThrow(ComplianceHardBlockError);
packages\compliance\src\huid\validate-presence.test.ts:52:    ).toThrow(ComplianceHardBlockError);
packages\compliance\src\huid\validate-presence.test.ts:64:      expect((e as ComplianceHardBlockError).meta).toEqual({ lineIndex: 1 });
packages\compliance\src\huid\validate-presence.ts:1:import { ComplianceHardBlockError } from '../errors';
packages\compliance\src\huid\validate-presence.ts:22: * but does not supply a HUID. Throws ComplianceHardBlockError with the
packages\compliance\src\huid\validate-presence.ts:33:      throw new ComplianceHardBlockError('compliance.huid_missing', {
apps/api/src\common\filters\global-exception.filter.ts:5:import { ComplianceHardBlockError } from '@goldsmith/compliance';
apps/api/src\common\filters\global-exception.filter.ts:104:    // 3. ComplianceHardBlockError — hard-block violation, map to 422
apps/api/src\common\filters\global-exception.filter.ts:105:    if (exception instanceof ComplianceHardBlockError) {

 succeeded in 191ms:
packages/crypto-envelope/src/local-kms.ts:6:export class LocalKMS implements KmsAdapter {
apps/api/src/modules/billing/billing.service.ts:140:    @Inject('KMS_ADAPTER')      private readonly kms: KmsAdapter,
apps/api/src/modules/billing/billing.module.ts:3:import { LocalKMS } from '@goldsmith/crypto-envelope';
apps/api/src/modules/billing/billing.module.ts:28:      provide: 'KMS_ADAPTER',
apps/api/src/modules/billing/billing.module.ts:29:      useFactory: () => new LocalKMS(),
scripts\tenant-delete.sh:52:echo "  (MVP: LocalKMS in-memory — deleted on process exit. Azure Key Vault ScheduleKeyDeletion lands with Infrastructure Story.)"
scripts\tenant-provision.sh:3:# MVP scope: uses LocalKMS (in-memory). Azure Key Vault integration lands in Infrastructure Story.
scripts\tenant-provision.sh:40:echo "→ provisioning LocalKMS KEK (MVP — Azure Key Vault deferred per ADR-0015) ..."
scripts\tenant-provision.sh:41:# LocalKMS is per-process in-memory, so this only records a placeholder ARN.

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content 'apps/api/src/common/filters/global-exception.filter.ts'" in C:\Alok\Business Projects\Goldsmith
 succeeded in 219ms:
import { randomUUID } from 'node:crypto';
import { Catch, type ArgumentsHost, type ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response, Request } from 'express';
import { logger } from '@goldsmith/observability';
import { ComplianceHardBlockError } from '@goldsmith/compliance';

interface ProblemJson {
  type: string;
  title: string;
  status: number;
  detail: string;
  requestId: string;
  code?: string;
  [extra: string]: unknown;
}

const PG_CODE_MAP: Record<string, { status: number; title: string; code: string }> = {
  '23505': { status: HttpStatus.CONFLICT,               title: 'conflict',               code: 'conflict' },
  '23503': { status: HttpStatus.UNPROCESSABLE_ENTITY,   title: 'foreign_key_violation',  code: 'foreign_key_violation' },
  '23514': { status: HttpStatus.UNPROCESSABLE_ENTITY,   title: 'check_violation',        code: 'check_violation' },
};

// Matches +CC followed by 7-15 digits â€” coarse but good enough for defense-in-depth.
const PHONE_REGEX = /\+\d{7,15}/g;

function redactPhones(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(PHONE_REGEX, '[REDACTED_PHONE]');
  if (Array.isArray(value)) return value.map(redactPhones);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = redactPhones(v);
    return out;
  }
  return value;
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      ...(err as unknown as Record<string, unknown>),
    };
  }
  return { value: err };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const httpCtx = host.switchToHttp();
    const res = httpCtx.getResponse<Response>();
    const req = httpCtx.getRequest<Request>();
    const incoming = req.headers['x-request-id'];
    const requestId = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
    res.setHeader('x-request-id', requestId);

    // 1. HttpException â€” preserve existing code-hoist behaviour
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const bodyCode = typeof body === 'object' && body && 'code' in body ? String((body as { code: unknown }).code) : undefined;
      const bodyTitle = typeof body === 'object' && body && 'title' in body && (body as { title: unknown }).title != null
        ? String((body as { title: unknown }).title)
        : undefined;
      const problem: ProblemJson = {
        type: 'about:blank',
        title: bodyCode ?? bodyTitle ?? 'http_exception',
        status,
        detail: exception.message,
        requestId,
        ...(bodyCode ? { code: bodyCode } : {}),
        ...(typeof body === 'object' && body !== null
          ? Object.fromEntries(
              Object.entries(body as Record<string, unknown>).filter(
                ([k]) => k !== 'code' && k !== 'message' && k !== 'status' && k !== 'statusCode' && k !== 'title' && k !== 'type',
              ),
            )
          : {}),
      };
      logger.warn({ err: redactPhones(serializeError(exception)), status, requestId }, 'http exception');
      res.status(status).json(problem);
      return;
    }

    // 2. pg constraint violations â€” map to structured 4xx
    const pgCode = (exception as { code?: string } | null | undefined)?.code;
    if (pgCode && PG_CODE_MAP[pgCode]) {
      const mapped = PG_CODE_MAP[pgCode];
      const problem: ProblemJson = {
        type: 'about:blank',
        title: mapped.title,
        status: mapped.status,
        detail: 'Database constraint violated.',
        requestId,
        code: mapped.code,
      };
      logger.error({ err: redactPhones(serializeError(exception)), pgCode, requestId }, 'pg constraint violation');
      res.status(mapped.status).json(problem);
      return;
    }

    // 3. ComplianceHardBlockError â€” hard-block violation, map to 422
    if (exception instanceof ComplianceHardBlockError) {
      res.status(422).json({
        statusCode: 422,
        code: exception.code,
        ...exception.meta,
      });
      return;
    }

    // 4. Anything else â€” generic 500, no message leak
    const problem: ProblemJson = {
      type: 'about:blank',
      title: 'internal_error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: 'An unexpected error occurred.',
      requestId,
      code: 'internal_error',
    };
    logger.error({ err: redactPhones(serializeError(exception)), requestId }, 'unhandled exception');
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(problem);
  }
}

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "MAKING_CHARGE_DEFAULTS" packages/shared apps/api/src/modules/settings' in C:\Alok\Business Projects\Goldsmith
 succeeded in 212ms:
apps/api/src/modules/settings\settings.repository.test.ts:6:import { MAKING_CHARGE_DEFAULTS } from '@goldsmith/shared';
apps/api/src/modules/settings\settings.repository.test.ts:154:      const defaults = MAKING_CHARGE_DEFAULTS;
apps/api/src/modules/settings\settings.repository.test.ts:180:      const existing: MakingChargeConfig[] = MAKING_CHARGE_DEFAULTS.map((c) => c);
apps/api/src/modules/settings\settings.repository.test.ts:197:        testRepo.upsertMakingCharges(patchItems, MAKING_CHARGE_DEFAULTS),
apps/api/src/modules/settings\settings.repository.test.ts:221:        testRepo.upsertMakingCharges(patchItems, MAKING_CHARGE_DEFAULTS),
apps/api/src/modules/settings\settings.service.ts:5:  PatchMakingChargesSchema, MAKING_CHARGE_DEFAULTS, PatchWastageSchema, WASTAGE_DEFAULTS,
apps/api/src/modules/settings\settings.service.ts:255:      configs = MAKING_CHARGE_DEFAULTS;
apps/api/src/modules/settings\settings.service.ts:258:      configs = MAKING_CHARGE_DEFAULTS.map((d) => storedMap.get(d.category) ?? d);
apps/api/src/modules/settings\settings.service.ts:271:    const { before, after } = await this.repo.upsertMakingCharges(parsed.data, MAKING_CHARGE_DEFAULTS);
packages/shared\src\index.ts:20:  MAKING_CHARGE_DEFAULTS,
packages/shared\src\schemas\making-charges.schema.ts:38:export const MAKING_CHARGE_DEFAULTS: MakingChargeConfig[] = [
apps/api/src/modules/settings\settings.service.test.ts:9:import { MAKING_CHARGE_DEFAULTS, WASTAGE_DEFAULTS } from '@goldsmith/shared';
apps/api/src/modules/settings\settings.service.test.ts:30:    upsertMakingCharges: vi.fn().mockResolvedValue({ before: null, after: MAKING_CHARGE_DEFAULTS }),
apps/api/src/modules/settings\settings.service.test.ts:145:      expect(result).toEqual(MAKING_CHARGE_DEFAULTS);
apps/api/src/modules/settings\settings.service.test.ts:146:      expect(cache.setMakingCharges).toHaveBeenCalledWith(MAKING_CHARGE_DEFAULTS);
apps/api/src/modules/settings\settings.service.test.ts:154:      const expected = MAKING_CHARGE_DEFAULTS.map((d) =>
apps/api/src/modules/settings\settings.service.test.ts:158:      expect(result).toHaveLength(MAKING_CHARGE_DEFAULTS.length);
apps/api/src/modules/settings\settings.service.test.ts:201:      expect(auditSpy).toHaveBeenCalledWith(null, MAKING_CHARGE_DEFAULTS);
apps/api/src/modules/settings\settings.service.test.ts:211:      ).resolves.toEqual(MAKING_CHARGE_DEFAULTS);
apps/api/src/modules/settings\settings.service.test.ts:218:      expect(repo.upsertMakingCharges).toHaveBeenCalledWith(dto, MAKING_CHARGE_DEFAULTS);

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content 'packages/shared/src/schemas/making-charges.schema.ts'" in C:\Alok\Business Projects\Goldsmith
 succeeded in 238ms:
import { z } from 'zod';

export const ProductCategory = z.enum([
  'RINGS', 'CHAINS', 'BANGLES', 'BRIDAL', 'SILVER', 'WHOLESALE',
]);
export type ProductCategory = z.infer<typeof ProductCategory>;

const numericDecimalString = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'VALUE_FORMAT_INVALID')
  .refine((s) => parseFloat(s) > 0, 'VALUE_POSITIVE_REQUIRED');

export const MakingChargeConfigSchema = z.object({
  category: ProductCategory,
  type: z.enum(['percent', 'fixed_per_gram']),
  value: numericDecimalString,
});
export type MakingChargeConfig = z.infer<typeof MakingChargeConfigSchema>;

export const MakingChargesArraySchema = z.array(MakingChargeConfigSchema);

export const PatchMakingChargesSchema = z
  .array(MakingChargeConfigSchema)
  .min(1, 'ARRAY_MIN_ONE')
  .superRefine((items, ctx) => {
    for (const [i, item] of items.entries()) {
      if (item.type === 'percent' && parseFloat(item.value) > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'PERCENT_MAX_100',
          path: [i, 'value'],
        });
      }
    }
  });
export type PatchMakingChargesDto = z.infer<typeof PatchMakingChargesSchema>;

export const MAKING_CHARGE_DEFAULTS: MakingChargeConfig[] = [
  { category: 'RINGS',     type: 'percent', value: '12.00' },
  { category: 'CHAINS',    type: 'percent', value: '10.00' },
  { category: 'BANGLES',   type: 'percent', value: '8.00'  },
  { category: 'BRIDAL',    type: 'percent', value: '15.00' },
  { category: 'SILVER',    type: 'percent', value: '5.00'  },
  { category: 'WHOLESALE', type: 'percent', value: '7.00'  },
];

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content 'scripts/tenant-provision.sh'" in C:\Alok\Business Projects\Goldsmith
 succeeded in 201ms:
#!/usr/bin/env bash
# Usage: tenant-provision.sh --tenant <uuid-or-slug> [--slug <slug>] [--display <name>]
# MVP scope: uses LocalKMS (in-memory). Azure Key Vault integration lands in Infrastructure Story.
set -euo pipefail

TENANT_ID=""; SLUG=""; DISPLAY=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tenant)  TENANT_ID="$2"; shift 2 ;;
    --slug)    SLUG="$2"; shift 2 ;;
    --display) DISPLAY="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done
[[ -z "$TENANT_ID" ]] && { echo "--tenant required" >&2; exit 2; }

# UUID-validate TENANT_ID up front (defense-in-depth even for operator-run scripts)
UUID_RE='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
if ! [[ "$TENANT_ID" =~ $UUID_RE ]]; then
  echo "TENANT_ID must be a valid UUID (got: $TENANT_ID)" >&2
  exit 2
fi

SLUG="${SLUG:-$TENANT_ID}"
DISPLAY="${DISPLAY:-$SLUG}"

DB_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/goldsmith_dev}"

echo "â†’ inserting shops row for $TENANT_ID ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 \
  -v tenant_id="$TENANT_ID" \
  -v slug="$SLUG" \
  -v display="$DISPLAY" \
  <<'SQL'
INSERT INTO shops (id, slug, display_name, status)
VALUES (:'tenant_id'::uuid, :'slug', :'display', 'PROVISIONING')
ON CONFLICT (id) DO NOTHING;
SQL

echo "â†’ provisioning LocalKMS KEK (MVP â€” Azure Key Vault deferred per ADR-0015) ..."
# LocalKMS is per-process in-memory, so this only records a placeholder ARN.
# Real KEK provisioning lands with Azure Key Vault in the Infrastructure Story.
KEK_ARN="local:kms:${TENANT_ID}:placeholder"
psql "$DB_URL" -v ON_ERROR_STOP=1 -v tenant_id="$TENANT_ID" -v kek="$KEK_ARN" \
  -c "UPDATE shops SET kek_key_arn=:'kek', status='ACTIVE' WHERE id=:'tenant_id'::uuid;"

echo "â†’ running tenant-isolation harness against new tenant ..."
DATABASE_URL="$DB_URL" pnpm -F @goldsmith/testing-tenant-isolation test:tenant-isolation

echo "âœ“ tenant $TENANT_ID provisioned (KEK $KEK_ARN) and harness-gated"

2026-04-25T20:39:46.037380Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content '"'apps/api/src/modules/billing/billing.service.ts' | ForEach-Object { "'$i++; '"'{0,4}: {1}' -f "'$i, $_ } | Select-String -Pattern '"'resolveMakingChargePct|return match|encryptColumn|getShopKekArn|form60Encrypted|panCiphertext' -Context 2,2"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content '"'apps/api/src/modules/billing/billing.service.ts' | ForEach-Object { "'$i++; '"'{0,4}: {1}' -f "'$i, $_ } | Select-String -Pattern '"'resolveMakingChargePct|return match|encryptColumn|getShopKekArn|form60Encrypted|panCiphertext' -Context 2,2" in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content '"'apps/api/src/modules/billing/billing.service.ts' | ForEach-Object { "'$i++; '"'{0,4}: {1}' -f "'$i, $_ } | Select-String -Pattern '"'resolveMakingChargePct|return match|encryptColumn|getShopKekArn|form60Encrypted|panCiphertext' -Context 2,2"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content '"'apps/api/src/modules/billing/billing.module.ts' | ForEach-Object { "'$i++; '"'{0,4}: {1}' -f "'$i, $_ }' in C:\Alok\Business Projects\Goldsmith
2026-04-25T20:39:46.039244Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content '"'apps/api/src/modules/billing/billing.module.ts' | ForEach-Object { "'$i++; '"'{0,4}: {1}' -f "'$i, $_ }'` rejected: blocked by policy
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content '"'apps/api/src/modules/billing/billing.module.ts' | ForEach-Object { "'$i++; '"'{0,4}: {1}' -f "'$i, $_ }'` rejected: blocked by policy
2026-04-25T20:39:46.176091Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content '"'apps/shopkeeper/app/billing/new.tsx' | ForEach-Object { "'$i++; '"'{0,4}: {1}' -f "'$i, $_ } | Select-String -Pattern '"'setPendingDto|onPanCancel' -Context 2,2"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content '"'apps/shopkeeper/app/billing/new.tsx' | ForEach-Object { "'$i++; '"'{0,4}: {1}' -f "'$i, $_ } | Select-String -Pattern '"'setPendingDto|onPanCancel' -Context 2,2" in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content '"'apps/shopkeeper/app/billing/new.tsx' | ForEach-Object { "'$i++; '"'{0,4}: {1}' -f "'$i, $_ } | Select-String -Pattern '"'setPendingDto|onPanCancel' -Context 2,2"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"resolveMakingChargePct|return match\\?\\.value|encryptColumn\\(|getShopKekArn\\(|panCiphertext|form60Encrypted\" apps/api/src/modules/billing/billing.service.ts" in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "LocalKMS|KMS_ADAPTER|SettingsCache|SettingsRepository" apps/api/src/modules/billing/billing.module.ts' in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "setPendingDto|onPanCancel" apps/shopkeeper/app/billing/new.tsx' in C:\Alok\Business Projects\Goldsmith
 succeeded in 201ms:
3:import { LocalKMS } from '@goldsmith/crypto-envelope';
4:import { SettingsCache } from '@goldsmith/tenant-config';
8:import { SettingsRepository } from '../settings/settings.repository';
19:    SettingsRepository,
28:      provide: 'KMS_ADAPTER',
29:      useFactory: () => new LocalKMS(),
32:      provide: SettingsCache,
33:      useFactory: (redis: Redis) => new SettingsCache(redis, 60),

 succeeded in 202ms:
145:  private async resolveMakingChargePct(
162:    return match?.value ?? '12.00';
165:  private async getShopKekArn(shopUuid: string): Promise<string> {
296:        this.resolveMakingChargePct(resolvedProducts[i]?.category, input.makingChargePct),
364:    let panCiphertext: Buffer | null = null;
366:    let form60Encrypted: Buffer | null = null;
370:      const keyArn = await this.getShopKekArn(ctx.shopId);
372:        const env = await encryptColumn(this.kms, keyArn, normalizedPan);
373:        panCiphertext = serializeEnvelope(env);
378:        const env = await encryptColumn(this.kms, keyArn, form60Json);
379:        form60Encrypted = serializeEnvelope(env);
404:        panCiphertext,
406:        form60Encrypted,
471:        pan_captured:          panCiphertext !== null,
473:        form60_captured:       form60Encrypted !== null,

 succeeded in 187ms:
120:  const onPanCancel = useCallback(() => {
122:    setPendingDto(null);
190:        onCancel={onPanCancel}

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "estimatedAnnualIncomePaise|अनुमानित वार्षिक आय|incomePaise" apps/shopkeeper/src/features/billing/components/PanPromptSheet.tsx' in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content 'packages/compliance/src/errors.ts'" in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content 'packages/shared/src/schemas/invoice.schema.ts'" in C:\Alok\Business Projects\Goldsmith
 succeeded in 225ms:
21:  estimatedAnnualIncomePaise: string;
97:    const incomePaise = f60Income.replace(/[^0-9]/g, '');
103:        estimatedAnnualIncomePaise: incomePaise || '0',
216:              <Text style={styles.fieldLabel}>अनुमानित वार्षिक आय (₹) *</Text>
223:                accessibilityLabel="अनुमानित वार्षिक आय रुपये में"

 succeeded in 254ms:
/**
 * Thrown by compliance gates when a request must be hard-blocked.
 * The global exception filter maps this to 422 Unprocessable Entity
 * with body { code, ...meta } so clients get a stable error contract.
 *
 * `code` is one of the `compliance.*` keys defined per gate
 * (e.g. `compliance.huid_missing`, `compliance.cash_269st_exceeded`).
 */
export class ComplianceHardBlockError extends Error {
  constructor(
    public readonly code: string,
    public readonly meta: Record<string, unknown> = {},
  ) {
    super(`Compliance hard-block: ${code}`);
    this.name = 'ComplianceHardBlockError';
    // Preserve prototype across transpile to ES5 (instanceof checks survive Vitest pool boundaries)
    Object.setPrototypeOf(this, ComplianceHardBlockError.prototype);
  }
}

 succeeded in 276ms:
import { z } from 'zod';

const PaiseString = z.string().regex(/^\d+$/, 'paise must be non-negative integer string');
const DecimalWeight = z.string().regex(/^\d+(\.\d{1,4})?$/, 'weight must be DECIMAL(*,4)');
const DecimalPct    = z.string().regex(/^\d+(\.\d{1,2})?$/, 'percent must be DECIMAL(5,2)');
const HuidString    = z.string().regex(/^[A-Z0-9]{6}$/, 'HUID must be 6 uppercase alphanumeric');
const PhoneIndia    = z.string().regex(/^[6-9]\d{9}$/, 'phone must be 10 digits starting 6-9');
const Uuid          = z.string().uuid();

export const InvoiceLineSchema = z.object({
  productId:         Uuid.optional(),
  description:       z.string().min(1).max(500),
  huid:              HuidString.nullable().optional(),
  metalType:         z.enum(['GOLD', 'SILVER', 'PLATINUM']).optional(),
  purity:            z.string().max(16).optional(),
  netWeightG:        DecimalWeight.optional(),
  makingChargePct:   DecimalPct.optional(),
  stoneChargesPaise: PaiseString.default('0'),
  hallmarkFeePaise:  PaiseString.default('0'),
});

// PAN: AAAAA9999A â€” 5 uppercase alpha + 4 digits + 1 uppercase alpha (Rule 114B)
const PanString = z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN format â€” e.g. ABCDE1234F');

export const Form60Schema = z.object({
  name:                       z.string().min(2),
  address:                    z.string().min(10),
  reasonForNoPan:             z.string().min(5),
  estimatedAnnualIncomePaise: z.string().regex(/^\d+$/, 'Must be a non-negative integer string'),
});

export const CreateInvoiceSchema = z.object({
  customerName:  z.string().min(1).max(200),
  customerPhone: PhoneIndia.optional(),
  lines:         z.array(InvoiceLineSchema).min(1).max(50),
  // PAN Rule 114B â€” required when total >= Rs 2,00,000; normalised to uppercase before sending
  pan:           PanString.optional(),
  form60Data:    Form60Schema.optional(),
});

export type CreateInvoiceDtoType = z.infer<typeof CreateInvoiceSchema>;
export type InvoiceLineDtoType   = z.infer<typeof InvoiceLineSchema>;

// Response schema â€” paise emitted as decimal strings (BigInt-safe across JSON boundaries).
export const InvoiceItemResponseSchema = z.object({
  id:                 Uuid,
  productId:          Uuid.nullable(),
  description:        z.string(),
  hsnCode:            z.string(),
  huid:               z.string().nullable(),
  metalType:          z.string().nullable(),
  purity:             z.string().nullable(),
  netWeightG:         z.string().nullable(),
  ratePerGramPaise:   z.string().nullable(),
  makingChargePct:    z.string().nullable(),
  goldValuePaise:     PaiseString,
  makingChargePaise:  PaiseString,
  stoneChargesPaise:  PaiseString,
  hallmarkFeePaise:   PaiseString,
  gstMetalPaise:      PaiseString,
  gstMakingPaise:     PaiseString,
  lineTotalPaise:     PaiseString,
  sortOrder:          z.number().int().nonnegative(),
});

export const InvoiceResponseSchema = z.object({
  id:                 Uuid,
  shopId:             Uuid,
  invoiceNumber:      z.string(),
  invoiceType:        z.enum(['B2C', 'B2B_WHOLESALE']),
  customerId:         Uuid.nullable(),
  customerName:       z.string(),
  customerPhone:      z.string().nullable(),
  status:             z.enum(['DRAFT', 'ISSUED', 'VOIDED']),
  subtotalPaise:      PaiseString,
  gstMetalPaise:      PaiseString,
  gstMakingPaise:     PaiseString,
  totalPaise:         PaiseString,
  idempotencyKey:     z.string(),
  issuedAt:           z.string().datetime().nullable(),
  createdByUserId:    Uuid,
  createdAt:          z.string().datetime(),
  updatedAt:          z.string().datetime(),
  lines:              z.array(InvoiceItemResponseSchema),
});

export type InvoiceItemResponse = z.infer<typeof InvoiceItemResponseSchema>;
export type InvoiceResponse     = z.infer<typeof InvoiceResponseSchema>;

codex
The patch introduces a build-breaking reference in the shopkeeper app and two server-side regressions in billing: PAN encryption is wired to a non-persistent KMS, and category-based making charges no longer honor the established defaults. These issues can break invoice creation or produce incorrect invoice totals.

Full review comments:

- [P1] Replace the in-memory KMS adapter before encrypting invoice PANs — C:\Alok\Business Projects\Goldsmith\apps\api\src\modules\billing\billing.module.ts:28-29
  `LocalKMS` only keeps key material in the current process. In this codebase tenant provisioning persists a `shops.kek_key_arn` placeholder, not an actual key inside this Nest process, so the new `encryptColumn(this.kms, keyArn, ...)` path will fail with `key.unavailable` for every Rule 114B invoice. The same problem also appears after any restart or on a second API instance, because previously issued ciphertext can no longer be decrypted there.

- [P1] Preserve category defaults when no making-charge config exists — C:\Alok\Business Projects\Goldsmith\apps\api\src\modules\billing\billing.service.ts:162-162
  When a tenant has no `shop_settings` row yet, or a category is missing from `making_charges_json`, this now hardcodes `12.00` for every product. That silently changes invoice totals for categories whose existing defaults are different (`CHAINS` 10%, `BANGLES` 8%, `BRIDAL` 15%, etc.), so shops without a full custom config will be billed incorrectly as soon as the client omits `makingChargePct`.

- [P1] Remove the stale `setPendingDto` call from the new invoice screen — C:\Alok\Business Projects\Goldsmith\apps\shopkeeper\app\billing\new.tsx:122-122
  `setPendingDto` is not declared anywhere in this component anymore, so this screen no longer type-checks/builds. As written, importing `app/billing/new.tsx` will fail the shopkeeper app compilation before the PAN prompt can be exercised at runtime.
The patch introduces a build-breaking reference in the shopkeeper app and two server-side regressions in billing: PAN encryption is wired to a non-persistent KMS, and category-based making charges no longer honor the established defaults. These issues can break invoice creation or produce incorrect invoice totals.

Full review comments:

- [P1] Replace the in-memory KMS adapter before encrypting invoice PANs — C:\Alok\Business Projects\Goldsmith\apps\api\src\modules\billing\billing.module.ts:28-29
  `LocalKMS` only keeps key material in the current process. In this codebase tenant provisioning persists a `shops.kek_key_arn` placeholder, not an actual key inside this Nest process, so the new `encryptColumn(this.kms, keyArn, ...)` path will fail with `key.unavailable` for every Rule 114B invoice. The same problem also appears after any restart or on a second API instance, because previously issued ciphertext can no longer be decrypted there.

- [P1] Preserve category defaults when no making-charge config exists — C:\Alok\Business Projects\Goldsmith\apps\api\src\modules\billing\billing.service.ts:162-162
  When a tenant has no `shop_settings` row yet, or a category is missing from `making_charges_json`, this now hardcodes `12.00` for every product. That silently changes invoice totals for categories whose existing defaults are different (`CHAINS` 10%, `BANGLES` 8%, `BRIDAL` 15%, etc.), so shops without a full custom config will be billed incorrectly as soon as the client omits `makingChargePct`.

- [P1] Remove the stale `setPendingDto` call from the new invoice screen — C:\Alok\Business Projects\Goldsmith\apps\shopkeeper\app\billing\new.tsx:122-122
  `setPendingDto` is not declared anywhere in this component anymore, so this screen no longer type-checks/builds. As written, importing `app/billing/new.tsx` will fail the shopkeeper app compilation before the PAN prompt can be exercised at runtime.
