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
export async function walkTenantScopedEndpoints(app: INestApplication, input: WalkerInput): Promise<void> {
  const failures: WalkFailure[] = [];

  // Discover decorated handlers via module references.
  const server = app.getHttpServer();
  // For Story 1.1 we hardcode the known route since Nest's router introspection
  // across versions is brittle. When a second decorated route lands, extend this
  // list (or wire in DiscoveryService).
  const knownRoutes = [{ path: '/api/v1/auth/me', method: 'GET' as const, metadataKey: TENANT_WALKER_ROUTE }];

  for (const route of knownRoutes) {
    for (const tenant of input.tenants) {
      const res = await request(server)
        .get(route.path)
        .set('Authorization', `Bearer ${tenant.token}`);
      if (res.status !== 200) {
        failures.push({ tenantId: tenant.id, route: route.path, reason: `status ${res.status}: ${JSON.stringify(res.body)}` });
        continue;
      }
      if (res.body?.tenant?.id !== tenant.id) {
        failures.push({ tenantId: tenant.id, route: route.path, reason: `cross-tenant leak: tenant ${tenant.id} saw ${res.body?.tenant?.id}` });
      }
      if (res.body?.user?.id && res.body.user.id === '') {
        failures.push({ tenantId: tenant.id, route: route.path, reason: 'empty user.id' });
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`endpoint-walker found ${failures.length} failures:\n${failures.map(f => `  ${f.tenantId} @ ${f.route}: ${f.reason}`).join('\n')}`);
  }
}
