import type { ShopUserRole } from '@goldsmith/tenant-context';
import type { InviteRole } from './invite-staff.dto';

export interface StaffListItemDto {
  id: string;
  display_name: string;
  phone_last4: string;
  role: Exclude<ShopUserRole, 'platform_admin'>;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  invited_at: string | null;
  activated_at: string | null;
}

export interface InviteResponseDto {
  staff: {
    id: string;
    phone: string;
    display_name: string;
    role: InviteRole;
    status: 'INVITED';
    invited_at: string;
  };
  share: {
    text: string;
  };
}
