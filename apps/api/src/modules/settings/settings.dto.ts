import type { ShopProfileRow } from '@goldsmith/shared';
import type { SasUrlResult } from './blob-storage.service';

export interface ShopProfileResponseDto extends ShopProfileRow {
  etag: string;
}

export type LogoUploadUrlResponseDto = SasUrlResult;

export interface LoyaltyResponseDto {
  tiers: Array<{ name: string; thresholdPaise: number; badgeColor: string }>;
  earnRatePercentage: string;
  redemptionRatePercentage: string;
  etag: string;
}
