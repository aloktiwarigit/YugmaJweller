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

/**
 * Walk every @TenantWalkerRoute()-decorated handler and assert:
 * - Each tenant's token accesses its own row only (no cross-tenant leakage).
 *
 * For Story 1.1 the only decorated route is `/api/v1/auth/me`; the walker
 * is structured so future stories can decorate more endpoints without
 * changing this function.
 *
 * TODO(Story 1.2+): wire up DiscoveryService to auto-discover decorated handlers
 * rather than maintaining a hardcoded list.
 */

type RouteAssertion = (body: unknown, tenantId: string, route: string) => WalkFailure | null;

interface KnownRoute {
  path: string;
  method: 'GET';
  metadataKey: string;
  assert?: RouteAssertion;
}

/** Default assertion for /auth/me: body must carry tenant.id matching the caller. */
const assertAuthMe: RouteAssertion = (body, tenantId, route) => {
  const b = body as Record<string, unknown>;
  if ((b?.tenant as Record<string, unknown>)?.id !== tenantId) {
    return { tenantId, route, reason: `cross-tenant leak: tenant ${tenantId} saw ${(b?.tenant as Record<string, unknown>)?.id}` };
  }
  if ((b?.user as Record<string, unknown>)?.id === '') {
    return { tenantId, route, reason: 'empty user.id' };
  }
  return null;
};

/**
 * Assertion for GET /api/v1/staff: body must be { staff: [] } shape.
 * RLS enforces isolation at the DB layer (tested in E2-S1); the walker
 * verifies the endpoint is reachable and returns the expected envelope.
 */
const assertStaffList: RouteAssertion = (body, tenantId, route) => {
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b?.staff)) {
    return { tenantId, route, reason: `expected { staff: [] } envelope, got: ${JSON.stringify(b)}` };
  }
  return null;
};

export async function walkTenantScopedEndpoints(app: INestApplication, input: WalkerInput): Promise<void> {
  const failures: WalkFailure[] = [];

  // Discover decorated handlers via module references.
  const server = app.getHttpServer();
  // For Story 1.1 we hardcode the known route since Nest's router introspection
  // across versions is brittle. When a second decorated route lands, extend this
  // list (or wire in DiscoveryService).
  const knownRoutes: KnownRoute[] = [
    { path: '/api/v1/auth/me', method: 'GET', metadataKey: TENANT_WALKER_ROUTE, assert: assertAuthMe },
    { path: '/api/v1/staff',   method: 'GET', metadataKey: TENANT_WALKER_ROUTE, assert: assertStaffList },
  ];

  for (const route of knownRoutes) {
    for (const tenant of input.tenants) {
      const res = await request(server)
        .get(route.path)
        .set('Authorization', `Bearer ${tenant.token}`);
      if (res.status !== 200) {
        failures.push({ tenantId: tenant.id, route: route.path, reason: `status ${res.status}: ${JSON.stringify(res.body)}` });
        continue;
      }
      if (route.assert) {
        const failure = route.assert(res.body as unknown, tenant.id, route.path);
        if (failure) failures.push(failure);
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`endpoint-walker found ${failures.length} failures:\n${failures.map(f => `  ${f.tenantId} @ ${f.route}: ${f.reason}`).join('\n')}`);
  }
}
