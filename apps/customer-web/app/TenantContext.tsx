'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { TenantConfigResponse } from '@/lib/api';

export const TenantContext = createContext<TenantConfigResponse | null>(null);

export function TenantProvider({
  value,
  children,
}: {
  value: TenantConfigResponse | null;
  children: ReactNode;
}) {
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantConfigResponse | null {
  return useContext(TenantContext);
}
