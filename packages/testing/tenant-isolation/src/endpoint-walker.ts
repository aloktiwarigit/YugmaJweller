import type { INestApplication } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import request from 'supertest';
import { TENANT_WALKER_ROUTE } from './tenant-walker-route.decorator';
import type { TenantWalkerRouteOptions } from './tenant-walker-route.decorator';

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
  /** Concrete substitutions for path parameter segments. */
  pathParams?: Record<string, string>;
  /**
   * Optional extra verification against the response body.
   * Return a failure reason string when isolation is violated, or null on pass.
   */
  verify?: (body: unknown, tenant: SeededTenantToken) => string | null;
  // Internal marker — preserved so the list origin is traceable.
  metadataKey?: string;
}

const HTTP_METHOD_MAP: Partial<Record<number, RouteEntry['method']>> = {
  [RequestMethod.GET]:    'GET',
  [RequestMethod.POST]:  'POST',
  [RequestMethod.PUT]:   'PUT',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.DELETE]: 'DELETE',
};

function resolvePathParams(path: string, params: Record<string, string>): string {
  return path.replace(/:([a-zA-Z_]+)/g, (_: string, key: string) => params[key] ?? `:${key}`);
}

async function discoverWalkerRoutes(app: INestApplication): Promise<RouteEntry[]> {
  const discovery = app.get(DiscoveryService);
  const scanner   = app.get(MetadataScanner);
  const reflector = app.get(Reflector);
  const routes: RouteEntry[] = [];

  for (const wrapper of discovery.getControllers()) {
    const { instance, metatype } = wrapper;
    if (!instance || typeof instance !== 'object' || !metatype) continue;

    const controllerPath =
      (Reflect.getMetadata('path', metatype) as string | undefined) ?? '';

    scanner.scanFromPrototype(
      instance,
      Object.getPrototypeOf(instance) as object,
      (methodKey: string) => {
        const handler = (instance as Record<string, unknown>)[methodKey];
        if (typeof handler !== 'function') return;

        const opts = reflector.get<TenantWalkerRouteOptions | undefined>(
          TENANT_WALKER_ROUTE,
          handler as (...args: unknown[]) => unknown,
        );
        if (opts === undefined) return;

        const handlerPath =
          (Reflect.getMetadata('path', handler as object) as string | undefined) ?? '';
        const methodCode =
          (Reflect.getMetadata('method', handler as object) as number | undefined) ?? RequestMethod.GET;

        const rawPath = `/${controllerPath}/${handlerPath}`.replace(/\/+/g, '/');
        const resolvedPath = opts.pathParams
          ? resolvePathParams(rawPath, opts.pathParams)
          : rawPath;

        routes.push({
          method:         HTTP_METHOD_MAP[methodCode] ?? 'GET',
          path:           resolvedPath,
          expectedStatus: opts.expectedStatus,
          body:           opts.body,
          verify:         opts.verify,
          metadataKey:    TENANT_WALKER_ROUTE,
        });
      },
    );
  }

  return routes;
}

/**
 * Walk every registered tenant-scoped endpoint and assert:
 * - Each tenant's token receives the expected success status (no server errors,
 *   no cross-tenant 4xx bleed).
 * - Optional per-route `verify` callbacks can assert deeper response-body
 *   invariants (e.g. the `/auth/me` tenant.id round-trip).
 *
 * Routes are auto-discovered via DiscoveryService by scanning all controllers
 * for handlers decorated with @TenantWalkerRoute().
 */
export async function walkTenantScopedEndpoints(
  app: INestApplication,
  input: WalkerInput,
): Promise<void> {
  const failures: WalkFailure[] = [];
  const server = app.getHttpServer();
  const routes = await discoverWalkerRoutes(app);

  for (const route of routes) {
    for (const tenant of input.tenants) {
      const expectedStatus = route.expectedStatus ?? 200;
      let req = request(server)
        [route.method.toLowerCase() as Lowercase<RouteEntry['method']>](route.path)
        .set('Authorization', `Bearer ${tenant.token}`);
      if (route.body !== undefined) req = req.send(route.body);

      const res = await req;

      if (res.status !== expectedStatus) {
        failures.push({
          tenantId: tenant.id,
          route:    `${route.method} ${route.path}`,
          reason:   `status ${res.status} (expected ${expectedStatus}): ${JSON.stringify(res.body)}`,
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
    throw new Error(
      `endpoint-walker found ${failures.length} failures:\n` +
      failures.map((f) => `  ${f.tenantId} @ ${f.route}: ${f.reason}`).join('\n'),
    );
  }
}
