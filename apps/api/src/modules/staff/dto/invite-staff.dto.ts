import { IsEnum, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import type { ShopUserRole } from '@goldsmith/tenant-context';

export type InviteRole = Extract<ShopUserRole, 'shop_manager' | 'shop_staff'>;

const INVITE_ROLES: InviteRole[] = ['shop_manager', 'shop_staff'];

export class InviteStaffDto {
  @IsString()
  @Matches(/^\+91[0-9]{10}$/, { message: 'phone must be a valid +91 Indian mobile number' })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  display_name!: string;

  @IsEnum(INVITE_ROLES, { message: 'role must be shop_manager or shop_staff' })
  role!: InviteRole;
}
