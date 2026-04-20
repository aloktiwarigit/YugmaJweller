import { Logger } from '@nestjs/common';

export interface ISmsAdapter {
  send(phone: string, message: string): Promise<void>;
}

export const SMS_ADAPTER = 'SMS_ADAPTER';

// TODO[MSG91]: replace with Msg91SmsAdapter when AiSensy/MSG91 onboards
export class StubSmsAdapter implements ISmsAdapter {
  private readonly logger = new Logger('SmsAdapter');

  async send(phone: string, message: string): Promise<void> {
    this.logger.log(`[SMS STUB] to=${phone} msg="${message}"`);
  }
}
