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

export interface RateLockResponseDto {
  rateLockDays: number;
  etag: string;
}

export interface LoyaltyResponseDto {
  tiers: Array<{ name: string; thresholdPaise: number; badgeColor: string }>;
  earnRatePercentage: string;
  redemptionRatePercentage: string;
  etag: string;
}

export interface TryAtHomeResponseDto {
  tryAtHomeEnabled: boolean;
  tryAtHomeMaxPieces: number;
  etag: string;
}

export interface FeatureFlagsResponseDto {
  try_at_home: boolean;
  max_pieces: number;
}

export interface CustomOrderPolicyResponseDto {
  customOrderPolicyText: string | null;
  etag: string;
}

export interface ReturnPolicyResponseDto {
  returnPolicyText: string | null;
  etag: string;
}

export interface NotificationPrefsResponseDto {
  orderUpdates:    { push: boolean; sms: boolean };
  loyaltyUpdates:  { push: boolean; sms: boolean };
  rateAlerts:      { push: boolean; sms: boolean };
  staffActivity:   { push: boolean };
  paymentReceipts: { push: boolean; sms: boolean };
  etag: string;
}
