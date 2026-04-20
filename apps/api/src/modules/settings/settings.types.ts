import type { ShopProfileRow, MakingChargeConfig } from '@goldsmith/shared';

export interface UpdateProfileResult {
  before: ShopProfileRow;
  after: ShopProfileRow;
}

export interface UpdateMakingChargesResult {
  before: MakingChargeConfig[] | null;
  after: MakingChargeConfig[];
}
