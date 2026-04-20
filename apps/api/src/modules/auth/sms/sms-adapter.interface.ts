export const SMS_ADAPTER = 'SMS_ADAPTER';

export interface ISmsAdapter {
  sendOtp(phone: string, otp: string): Promise<void>;
  sendInvite(phone: string, shopName: string, inviteCode: string): Promise<void>;
}
