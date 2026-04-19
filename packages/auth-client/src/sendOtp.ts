import { auth } from './firebase';
import { normalizePhone } from './normalize-phone';

export async function sendOtp(phone: string): Promise<unknown> {
  const e164 = normalizePhone(phone);
  return auth().signInWithPhoneNumber(e164);
}
