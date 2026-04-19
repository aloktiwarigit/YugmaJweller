export interface StaffListItemDto {
  id: string;
  display_name: string;
  phone_last4: string;
  role: 'shop_admin' | 'shop_manager' | 'shop_staff';
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  invited_at: string | null;
  activated_at: string | null;
}

export interface InviteResponseDto {
  staff: {
    id: string;
    phone: string;
    display_name: string;
    role: 'shop_manager' | 'shop_staff';
    status: 'INVITED';
    invited_at: string;
  };
  share: {
    text: string;
  };
}
