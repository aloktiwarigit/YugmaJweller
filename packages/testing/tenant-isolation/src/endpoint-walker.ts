import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TENANT_WALKER_ROUTE } from './tenant-walker-route.decorator';

export interface SeededTenantToken {
  id: string;
  slug: string;
  firebaseUid: string;
  token: string;
}

export interface WalkerInput {
  tenants: SeededTenantToken[];
}

export interface WalkFailure {
  tenantId: string;
  route: string;
  reason: string;
}

/** A single route entry for the tenant isolation walker. */
export interface RouteEntry {
  /** HTTP method in uppercase. */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Full path including /api/v1 prefix. */
  path: string;
  /** Optional request body sent for mutation methods. */
  body?: Record<string, unknown>;
  /** Expected HTTP success status (defaults to 200). */
  expectedStatus?: number;
  /**
   * Optional extra verification against the response body.
   * Return a failure reason string when isolation is violated, or null on pass.
   */
  verify?: (body: unknown, tenant: SeededTenantToken) => string | null;
  // Internal marker — preserved so the list origin is traceable.
  metadataKey?: string;
}

/**
 * Walk every registered tenant-scoped endpoint and assert:
 * - Each tenant's token receives the expected success status (no server errors,
 *   no cross-tenant 4xx bleed).
 * - Optional per-route `verify` callbacks can assert deeper response-body
 *   invariants (e.g. the `/auth/me` tenant.id round-trip).
 *
 * The `knownRoutes` list is the canonical registry. Add new entries here when
 * a new tenant-scoped endpoint lands.
 *
 * TODO(Story 1.2+): wire up DiscoveryService to auto-discover @TenantWalkerRoute()
 * decorated handlers rather than maintaining a hardcoded list.
 */
export async function walkTenantScopedEndpoints(app: INestApplication, input: WalkerInput): Promise<void> {
  const failures: WalkFailure[] = [];

  const server = app.getHttpServer();

  // ─── Registered tenant-scoped endpoints ──────────────────────────────────
  // Add new entries here when a tenant-scoped endpoint is introduced.
  // The walker fires each entry for every seeded tenant and asserts:
  //   1. Response status matches `expectedStatus` (default 200).
  //   2. `verify` callback (if present) returns null (no isolation violation).
  const knownRoutes: RouteEntry[] = [
    // Story 1.1 — /auth/me: deep tenant.id round-trip check.
    {
      path: '/api/v1/auth/me',
      method: 'GET',
      metadataKey: TENANT_WALKER_ROUTE,
      verify: (body, tenant) => {
        const b = body as Record<string, unknown> | null;
        if ((b as { tenant?: { id?: string } } | null)?.tenant?.id !== tenant.id) {
          return `cross-tenant leak: tenant ${tenant.id} saw ${(b as { tenant?: { id?: string } } | null)?.tenant?.id}`;
        }
        if ((b as { user?: { id?: string } } | null)?.user?.id === '') {
          return 'empty user.id';
        }
        return null;
      },
    },

    // Story 1.2 — POST /auth/invite: shop_admin can invite staff; response
    // must be scoped to the calling tenant (shop_id enforced by service layer).
    {
      path: '/api/v1/auth/invite',
      method: 'POST',
      expectedStatus: 201,
      body: { phone: '+919876543210', role: 'shop_staff', display_name: 'Test Staff' },
    },

    // Story 1.2 — GET /auth/users: list users scoped to calling tenant.
    // RLS + service-layer shopId binding ensures no cross-tenant rows leak.
    {
      path: '/api/v1/auth/users',
      method: 'GET',
      expectedStatus: 200,
    },

    // Story 1.3 — GET /auth/roles/:role/permissions: tenant-scoped permission
    // lookup; response is a flat key→boolean map for the given role.
    {
      path: '/api/v1/auth/roles/shop_manager/permissions',
      method: 'GET',
      expectedStatus: 200,
    },

    // Story 1.3 — PUT /auth/roles/:role/permissions: upsert one permission for
    // the calling tenant; 200 on success (void body).
    {
      path: '/api/v1/auth/roles/shop_manager/permissions',
      method: 'PUT',
      expectedStatus: 200,
      body: { permission_key: 'billing.create', is_enabled: true },
    },
  ];
  // ─────────────────────────────────────────────────────────────────────────

  for (const route of knownRoutes) {
    for (const tenant of input.tenants) {
      const expectedStatus = route.expectedStatus ?? 200;
      let req = request(server)[route.method.toLowerCase() as Lowercase<RouteEntry['method']>](route.path)
        .set('Authorization', `Bearer ${tenant.token}`);
      if (route.body !== undefined) {
        req = req.send(route.body);
      }
      const res = await req;

      if (res.status !== expectedStatus) {
        failures.push({
          tenantId: tenant.id,
          route: `${route.method} ${route.path}`,
          reason: `status ${res.status} (expected ${expectedStatus}): ${JSON.stringify(res.body)}`,
        });
        continue;
      }

      if (route.verify) {
        const violation = route.verify(res.body as unknown, tenant);
        if (violation !== null) {
          failures.push({ tenantId: tenant.id, route: `${route.method} ${route.path}`, reason: violation });
        }
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`endpoint-walker found ${failures.length} failures:\n${failures.map(f => `  ${f.tenantId} @ ${f.route}: ${f.reason}`).join('\n')}`);
  }
}
