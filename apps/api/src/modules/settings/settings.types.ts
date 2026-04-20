import type { ShopProfileRow } from '@goldsmith/shared';
import { LoyaltyConfig } from '@goldsmith/shared';

export interface UpdateProfileResult {
  before: ShopProfileRow;
  after: ShopProfileRow;
}

export type UpdateLoyaltyResult = { ok: true; config: LoyaltyConfig } | { ok: false; error: string };
