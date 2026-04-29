# 0008 — White-Label: Shared App with Tenant Theming; Per-Tenant Native Apps Deferred

**Status:** Accepted
**Date:** 2026-04-17
**Deciders:** Winston (Architect), Mary (BA), Alok (Agency)

## Context

PRD FR2 + FR98 + Innovation #2 + NFR-C7 require **each jeweller's customer-facing surfaces to show ONLY their brand** — logo, colours, app name, domain. Goldsmith platform brand is NEVER visible to customers. This is the differentiating moat per PRFAQ.

Two delivery strategies were evaluated:
1. **Shared app with tenant theming** — one mobile binary per app; theme resolved at runtime from tenant config; one web build with tenant-CNAME-driven theming.
2. **Per-tenant native apps** — each jeweller gets their own iOS/Android binary in App Store / Play Store under their developer account.

Per-tenant native apps are the product vision but prohibitively expensive for MVP (10+ app submissions, review cycles, EAS builds per tenant, developer-account negotiations). PRD Innovation risk-mitigation explicitly scopes MVP as shared-with-theming.

## Decision

**MVP:** shared app binaries (one per use case: shopkeeper, customer mobile, customer web) with **runtime tenant theming**. Per-tenant native mobile app submissions deferred to Phase 4+ when tenant count + commercial terms justify.

**Web:** Next.js middleware resolves tenant from host (CNAME) → populates CSS variables server-side → Tailwind/shadcn components theme via vars. ISR caches per-tenant.

**Mobile:** Customer app is shared binary. Tenant is resolved at first launch via (a) deep link containing tenant slug, (b) shop QR code scanned, (c) explicit "find my shop" flow. Once resolved, tenant is persisted in secure storage; `<ThemeProvider>` applies ResolvedTokens on every render.

**Shopkeeper mobile**: only serves one tenant per install (staff of one shop); tenant resolved at login; theme applied globally.

**Theme resolution pipeline:**
1. Tenant config stored in `shop_settings` table with `theme_config` JSONB column: `{ primaryHex, accentHex, logoUrl, appName, customDomain, neutralTone, devanagariFontStack }`.
2. HCT algorithm (`@material/material-color-utilities`) generates the full 50-950 scale from primary + accent seeds.
3. Validated against WCAG AA at provisioning (reject seed if contrast fails).
4. Resolved tokens exported as `ResolvedTokens` object.
5. Web: CSS variables injected at `<body>` by Next.js middleware per request.
6. Mobile: `<ThemeProvider value={resolvedTokens}>` at app root.

**Tenant-agnostic code rules:**
- `packages/ui-web` + `packages/ui-mobile` primitives consume tokens via context; NO hex literals.
- Semgrep rule `goldsmith/no-hex-in-customer-app` forbids hex values in `apps/customer/**` and `apps/web/**` (platform admin exempt).
- Visual regression (Chromatic) runs each Storybook story against 3 tenants (anchor + 2 mock) to catch theme drift.
- Platform-brand asset imports blocked by ESLint in customer apps (`no-restricted-imports` rule on `@/assets/platform-*`).

**CNAME + domain delivery:**
- Tenant provisioning (ADR-0010) creates Route 53 CNAME → `goldsmith-edge.ap-south-1.amazonaws.com` (CloudFront).
- ACM certificate auto-issued per tenant domain.
- CloudFront Lambda@Edge reads `Host` header, resolves tenant via cache-friendly lookup, forwards `X-Tenant-Id` header to origin.
- Custom-domain setup is self-service (shopkeeper enters desired domain → admin console verifies DNS TXT ownership before activation).

## Consequences

**Positive:**
- One mobile app build per role vs 10+ — massive cost savings.
- One web build — CDN-friendly, fast deploys.
- Rapid tenant onboarding (< 1 day at M12) because no binary work.
- Theme changes are hot (shopkeeper edits primary color → customer app reflects in < 5 min after cache TTL).
- Goldsmith platform brand is structurally invisible via lint + VR + runtime theme.

**Negative / trade-offs:**
- Mobile apps show in stores as "Goldsmith Customer" (platform app name) or similar — first-impression branding is on the "Open in Your Jeweller's App" flow, not the store listing. Mitigated by app-store listing emphasizing the white-label nature; customers almost always arrive via WhatsApp or store QR, not store search.
- Cannot be in the "Tanishq Jewellery" search result on Play Store under the anchor's name — acceptable trade-off for cost.
- Per-tenant native apps become a Phase 4+ upgrade when ROI + commercial terms support.

## Alternatives Considered

| Option | Rejected because |
|--------|------------------|
| **Per-tenant native apps from Day 1** | Prohibitive cost (10+ store submissions, 10+ developer accounts); operational burden; timeline-breaking |
| **White-label via dynamic JS bundle per tenant** | Complexity without benefit over CSS variables |
| **Single custom domain for platform with tenant subpath (e.g., goldsmith.com/anchor/...)** | Visible "goldsmith" brand to customers — violates FR98 |
| **React Native per-tenant builds at EAS level** | Possible (EAS supports variants) but operational cost > runtime theming; reserved for Phase 4+ |

## Implementation Notes

### Theme resolver

```ts
// packages/ui-theme/src/resolve.ts
import { argbFromHex, themeFromSourceColor } from '@material/material-color-utilities';

export function resolveTheme(config: ShopThemeConfig): ResolvedTokens {
  const primary = themeFromSourceColor(argbFromHex(config.primaryHex));
  const accent = themeFromSourceColor(argbFromHex(config.accentHex ?? DEFAULT_ACCENT));
  validateWcagAA(primary, config.neutralTone);
  return {
    colors: {
      primary: toTokenScale(primary),
      accent: toTokenScale(accent),
      neutral: neutralScaleByTone(config.neutralTone),
      semantic: PLATFORM_SEMANTIC,    // NOT tenant-overridable per UX spec
    },
    typography: typographyFromFontStack(config.devanagariFontStack),
    // ... spacing, motion, elevation all from platform defaults
  };
}
```

### Next.js middleware (web)

```ts
// apps/web/src/middleware.ts
import { NextResponse } from 'next/server';

export async function middleware(req) {
  const host = req.headers.get('host') ?? '';
  const tenant = await resolveTenantByHost(host); // cache-backed
  if (!tenant) return new Response('Unknown tenant', { status: 404 });

  const resolved = await resolveTheme(tenant.themeConfig);
  const res = NextResponse.next();
  res.headers.set('X-Tenant-Id', tenant.id);
  // ResolvedTokens is serialized into cookie for client-side hydration + CSS vars injected server-side via tree
  res.cookies.set('tenant-theme', JSON.stringify(resolved), { httpOnly: false });
  return res;
}
```

### Mobile ThemeProvider

```tsx
// apps/customer/src/providers/ThemeProvider.tsx
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const tenant = useTenant();
  const resolved = useMemo(() => resolveTheme(tenant.themeConfig), [tenant.themeConfig]);
  return <ThemeContext.Provider value={resolved}>{children}</ThemeContext.Provider>;
}
```

## Revisit triggers

- Anchor or paying jeweller commercially sponsors per-tenant native app — evaluate EAS variant builds (Phase 4+).
- Store-search discoverability becomes a material customer acquisition channel.
- 100+ tenants and admin burden of runtime theming exceeds per-tenant-builds cost.

## References

- PRD FR2, FR98, Innovation #2
- Architecture §Core Decisions F4 (white-label theming implementation)
- UX spec §White-Label Discipline (challenge #3)
