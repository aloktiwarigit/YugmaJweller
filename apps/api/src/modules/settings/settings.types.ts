import type { ShopProfileRow, MakingChargeConfig, WastageConfig } from '@goldsmith/shared';

export interface UpdateProfileResult {
  before: ShopProfileRow;
  after: ShopProfileRow;
}

export interface UpdateMakingChargesResult {
  before: MakingChargeConfig[] | null;
  after: MakingChargeConfig[];
}

export interface UpdateWastageResult {
  before: WastageConfig[] | null;
  after:  WastageConfig[];
}
