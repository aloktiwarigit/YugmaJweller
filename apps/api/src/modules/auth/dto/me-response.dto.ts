import type { ShopUserRole } from '@goldsmith/tenant-context';

export interface MeResponseDto {
  user: { id: string; role: ShopUserRole };
  tenant: { id: string; slug: string; display_name: string };
}
