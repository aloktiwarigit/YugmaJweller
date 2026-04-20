import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api } from '../../../api/client';

export interface StaffMember {
  id: string;
  phone: string;
  display_name: string;
  role: 'shop_staff' | 'shop_manager' | 'shop_admin';
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  invited_at: string | null;
}

async function fetchStaffList(): Promise<StaffMember[]> {
  const res = await api.get<StaffMember[]>('/api/v1/auth/staff');
  return res.data;
}

export function useStaffList(): UseQueryResult<StaffMember[]> {
  return useQuery({
    queryKey: ['staff'],
    queryFn: fetchStaffList,
  });
}
