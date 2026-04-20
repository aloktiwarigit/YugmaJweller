import { Injectable, Logger } from '@nestjs/common';
import { ISmsAdapter } from './sms-adapter.interface';

@Injectable()
export class MockSmsAdapter implements ISmsAdapter {
  private readonly logger = new Logger(MockSmsAdapter.name);

  async sendOtp(phone: string, otp: string): Promise<void> {
    this.logger.log(`[MockSMS] OTP ${otp} → ${phone}`);
  }

  async sendInvite(phone: string, shopName: string, inviteCode: string): Promise<void> {
    this.logger.log(`[MockSMS] Invite to ${phone} for shop ${shopName}, code ${inviteCode}`);
  }
}
