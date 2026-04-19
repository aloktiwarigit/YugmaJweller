// ok: use the service abstraction, not raw SQL
import { AuthRateLimitService } from '../auth-rate-limit.service';
declare const svc: AuthRateLimitService;
declare const phone: string;

await svc.checkAndIncrement(phone);
