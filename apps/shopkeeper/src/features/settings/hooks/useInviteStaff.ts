import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { api } from '../../../api/client';
import type { StaffMember } from './useStaffList';

export interface InviteStaffPayload {
  phone: string;
  role: 'shop_manager' | 'shop_staff';
}

async function postInviteStaff(payload: InviteStaffPayload): Promise<StaffMember> {
  const res = await api.post<StaffMember>('/api/v1/auth/invite', payload);
  return res.data;
}

export function useInviteStaff(): UseMutationResult<StaffMember, Error, InviteStaffPayload> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postInviteStaff,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}
