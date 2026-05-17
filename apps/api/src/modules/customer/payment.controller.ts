import {
  Controller,
  Get,
  Header,
  Inject,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Pool } from 'pg';
import { withShopTx } from '@goldsmith/db';
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import {
  verifyPaymentToken,
  consumePaymentSession,
  type PaymentTokenClaims,
} from './payment-token';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('/api/v1/pay')
@SkipAuth()
@SkipTenant()
export class PaymentController {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  @Get('rate-lock')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  async rateLockPage(
    @Query('token') tokenStr: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    // 1. Signature + shape + expiry — pure, no I/O.
    const claims = verifyPaymentToken(tokenStr ?? '');
    if (!claims) {
      res.status(401).send(buildErrorHtml('भुगतान लिंक अमान्य या समाप्त हो गया है। कृपया ऐप से पुनः प्रयास करें।'));
      return;
    }

    // Defense-in-depth: the HMAC already guarantees integrity, but reject any
    // non-UUID shop_id before it reaches `SET LOCAL app.current_shop_id`.
    if (!UUID_RE.test(claims.shopId)) {
      res.status(401).send(buildErrorHtml('भुगतान लिंक अमान्य है।'));
      return;
    }

    // 2. All booking/shop validations + atomic consume inside one tenant-
    //    scoped transaction. The session is consumed ONLY when every check
    //    passes — replay protection, missing-order protection, inactive-shop
    //    protection all share the same commit.
    type Outcome =
      | { kind: 'render';    orderId: string; amountPaise: string; shopName: string }
      | { kind: 'error_401' }
      | { kind: 'error_404'; message: string }
      | { kind: 'error_409' }
      | { kind: 'error_500'; message: string };

    const outcome: Outcome = await withShopTx(this.pool, claims.shopId, async (tx) => {
      // Booking ownership + status + Razorpay order id.
      const bookingRes = await tx.query<{
        razorpay_order_id:    string | null;
        deposit_amount_paise: string;
        status:               string;
      }>(
        `SELECT razorpay_order_id, deposit_amount_paise::text, status
           FROM rate_lock_bookings
          WHERE id = $1 AND customer_id = $2 AND shop_id = $3`,
        [claims.bookingId, claims.customerId, claims.shopId],
      );
      const booking = bookingRes.rows[0];
      if (!booking) {
        return { kind: 'error_404', message: 'भुगतान उपलब्ध नहीं है।' };
      }
      if (booking.status !== 'PENDING_PAYMENT') {
        return { kind: 'error_404', message: 'भुगतान उपलब्ध नहीं है।' };
      }
      const orderId = booking.razorpay_order_id;
      if (!orderId) {
        // Do NOT consume the session — the link can be re-opened once the
        // order id is provisioned.
        return { kind: 'error_500', message: 'भुगतान ऑर्डर अभी तैयार नहीं है।' };
      }

      // Shop must be ACTIVE.
      const shopRes = await tx.query<{ display_name: string; status: string }>(
        `SELECT display_name, status
           FROM shops
          WHERE id = $1
          LIMIT 1`,
        [claims.shopId],
      );
      const shop = shopRes.rows[0];
      if (!shop || shop.status !== 'ACTIVE') {
        // Do NOT consume — if the shop comes back ACTIVE before the token
        // expires the customer can still complete payment.
        return { kind: 'error_404', message: 'दुकान उपलब्ध नहीं है।' };
      }

      // All upstream invariants hold. Now consume the session row atomically.
      const consume = await consumePaymentSession(tx, claims);
      if (!consume.ok) {
        if (consume.reason === 'already_consumed' || consume.reason === 'expired') {
          return { kind: 'error_409' };
        }
        // 'invalid' or 'claim_mismatch' — treat like a forged/altered token.
        return { kind: 'error_401' };
      }

      return {
        kind:        'render',
        orderId,
        amountPaise: booking.deposit_amount_paise,
        shopName:    shop.display_name,
      };
    });

    switch (outcome.kind) {
      case 'error_401':
        res.status(401).send(buildErrorHtml('भुगतान लिंक अमान्य या समाप्त हो गया है। कृपया ऐप से पुनः प्रयास करें।'));
        return;
      case 'error_404':
        res.status(404).send(buildErrorHtml(outcome.message));
        return;
      case 'error_409':
        res.status(409).send(buildErrorHtml('भुगतान लिंक पहले ही उपयोग किया जा चुका है। नया लिंक प्राप्त करने के लिए ऐप खोलें।'));
        return;
      case 'error_500':
        res.status(500).send(buildErrorHtml(outcome.message));
        return;
      case 'render': {
        const keyId = process.env['RAZORPAY_KEY_ID'] ?? '';
        res.send(buildRazorpayCheckoutHtml({
          orderId:     outcome.orderId,
          amountPaise: outcome.amountPaise,
          shopName:    outcome.shopName,
          keyId,
        }));
        return;
      }
    }
  }
}

// Exported for unit tests; internal otherwise.
export type { PaymentTokenClaims };

function buildErrorHtml(message: string): string {
  const esc = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<!DOCTYPE html><html lang="hi"><head><meta charset="utf-8"/>
<title>भुगतान — त्रुटि</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#FFFBF5;margin:0}
.card{text-align:center;padding:2rem;max-width:360px}h1{color:#DC2626;font-size:1.2rem}</style>
</head><body><div class="card"><h1>त्रुटि</h1><p>${esc(message)}</p></div></body></html>`;
}

function buildRazorpayCheckoutHtml(params: {
  orderId:     string;
  amountPaise: string;
  shopName:    string;
  keyId:       string;
}): string {
  const escHtml = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const jsStr = (s: string): string => JSON.stringify(s);

  return `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>भुगतान — ${escHtml(params.shopName)}</title>
  <style>
    body { font-family: sans-serif; display:flex; align-items:center; justify-content:center;
           min-height:100vh; margin:0; background:#FFFBF5; }
    .card { text-align:center; padding:2rem; max-width:360px; }
    h1 { font-size:1.4rem; color:#1C1917; margin-bottom:0.5rem; }
    p  { color:#6B7280; font-size:0.9rem; margin-bottom:1.5rem; }
    button { background:#B8860B; color:#fff; border:none; border-radius:8px;
             padding:14px 32px; font-size:1rem; cursor:pointer; min-width:200px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escHtml(params.shopName)}</h1>
    <p>दर-लॉक जमा राशि — ₹${Math.round(Number(params.amountPaise) / 100).toLocaleString('en-IN')}</p>
    <button id="payBtn">Razorpay से भुगतान करें</button>
  </div>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    document.getElementById('payBtn').addEventListener('click', function() {
      var rzp = new Razorpay({
        key:         ${jsStr(params.keyId)},
        order_id:    ${jsStr(params.orderId)},
        amount:      ${jsStr(params.amountPaise)},
        currency:    "INR",
        name:        ${jsStr(params.shopName)},
        description: "दर-लॉक जमा राशि",
        handler: function() {
          document.querySelector('.card').innerHTML =
            '<h1>भुगतान सफल!</h1><p>ऐप पर वापस जाएं। बुकिंग जल्द सक्रिय होगी।</p>';
        },
        modal: { ondismiss: function() {} }
      });
      rzp.open();
    });
    window.addEventListener('load', function() {
      document.getElementById('payBtn').click();
    });
  </script>
</body>
</html>`;
}
