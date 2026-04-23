import type { ShopProfileRow, MakingChargeConfig, WastageConfig, TryAtHomeRow, NotificationPrefsConfig } from '@goldsmith/shared';
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

export interface UpdateCustomOrderPolicyResult {
  before: string | null;
  after:  string | null;
}

export interface UpdateReturnPolicyResult {
  before: string | null;
  after:  string | null;
}

export interface UpdateNotificationPrefsResult {
  before: NotificationPrefsConfig | null;
  after:  NotificationPrefsConfig;
}
