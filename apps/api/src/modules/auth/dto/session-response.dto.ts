import type { ShopUserRole } from '@goldsmith/tenant-context';

export interface SessionResponseDto {
  user: { id: string; display_name: string; role: ShopUserRole };
  tenant: { id: string; slug: string; display_name: string; config: Record<string, unknown> };
  requires_token_refresh: boolean;
}
