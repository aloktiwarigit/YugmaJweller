import type { ShopProfileRow, MakingChargeConfig, WastageConfig, TryAtHomeRow } from '@goldsmith/shared';
import { LoyaltyConfig } from '@goldsmith/shared';

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

export interface UpdateRateLockResult {
  before: number | null;
  after: number;
}

export type UpdateLoyaltyResult = { ok: true; config: LoyaltyConfig } | { ok: false; error: string };

export interface UpdateTryAtHomeResult {
  before: TryAtHomeRow;
  after: TryAtHomeRow;
}
