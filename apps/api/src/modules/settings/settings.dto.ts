import type { ShopProfileRow, MakingChargeConfig, WastageConfig } from '@goldsmith/shared';
import type { SasUrlResult } from './blob-storage.service';

export interface ShopProfileResponseDto extends ShopProfileRow {
  etag: string;
}

export type LogoUploadUrlResponseDto = SasUrlResult;

export interface MakingChargesResponseDto {
  configs: MakingChargeConfig[];
  etag: string;
}

export interface WastageResponseDto {
  configs: WastageConfig[];
  etag: string;
}

export interface LoyaltyResponseDto {
  tiers: Array<{ name: string; thresholdPaise: number; badgeColor: string }>;
  earnRatePercentage: string;
  redemptionRatePercentage: string;
  etag: string;
}
