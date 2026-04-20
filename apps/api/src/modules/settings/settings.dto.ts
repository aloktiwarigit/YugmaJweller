import type { ShopProfileRow, MakingChargeConfig } from '@goldsmith/shared';
import type { SasUrlResult } from './blob-storage.service';

export interface ShopProfileResponseDto extends ShopProfileRow {
  etag: string;
}

export type LogoUploadUrlResponseDto = SasUrlResult;

export interface MakingChargesResponseDto {
  configs: MakingChargeConfig[];
  etag: string;
}
