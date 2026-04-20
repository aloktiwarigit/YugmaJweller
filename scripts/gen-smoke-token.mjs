// Generates a Firebase ID token for smoke testing using the auth emulator.
// Usage: FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 node scripts/gen-smoke-token.mjs
import admin from 'firebase-admin';

const SHOP_ID = process.env.SHOP_ID ?? '6005c66a-46b2-4ce5-9989-c50aabf61302';

process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
const app = admin.initializeApp({ projectId: 'goldsmith-dev' }, 'smoke-test');

// Create (or get) a test user
let uid;
try {
  const u = await app.auth().getUserByPhoneNumber('+919900000001');
  uid = u.uid;
} catch {
  const u = await app.auth().createUser({ phoneNumber: '+919900000001', displayName: 'Smoke Admin' });
  uid = u.uid;
}

// Set custom claims: shop_admin for the anchor shop
await app.auth().setCustomUserClaims(uid, { shop_id: SHOP_ID, role: 'shop_admin' });

// Create a custom token, then exchange for ID token via emulator
const customToken = await app.auth().createCustomToken(uid);

// Exchange custom token → ID token via emulator REST
const resp = await fetch(
  `http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  },
);
const { idToken } = await resp.json();
console.log(idToken);
await app.delete();
