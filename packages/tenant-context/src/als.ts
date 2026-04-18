import { AsyncLocalStorage } from 'node:async_hooks';
import type { TenantContext } from './context';

const als = new AsyncLocalStorage<TenantContext>();

export const tenantContext = {
  runWith<T>(ctx: TenantContext, fn: () => T | Promise<T>): T | Promise<T> {
    return als.run(ctx, fn);
  },
  current(): TenantContext | undefined {
    return als.getStore();
  },
  requireCurrent(): TenantContext {
    const ctx = als.getStore();
    if (!ctx) throw new Error('tenant.context_not_set');
    return ctx;
  },
} as const;
