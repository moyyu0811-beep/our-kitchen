/* eslint-disable @typescript-eslint/no-var-requires */
const admin = require('firebase-admin');

console.log('[1] Script started. Node version:', process.version);

// ── Parse service account ─────────────────────────────────────────────────────
let serviceAccount;
try {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.error('[!] FIREBASE_SERVICE_ACCOUNT secret is not set.');
    process.exit(1);
  }
  serviceAccount = JSON.parse(raw);
  console.log('[2] Service account parsed. Project ID:', serviceAccount.project_id);
} catch (e) {
  console.error('[!] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', e.message);
  process.exit(1);
}

// ── Init Firebase Admin ───────────────────────────────────────────────────────
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('[3] Firebase Admin SDK initialized.');
} catch (e) {
  console.error('[!] admin.initializeApp failed:', e.message);
  process.exit(1);
}

const db = admin.firestore();
console.log('[4] Firestore ready.');

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  const now = new Date();
  let utcHour = now.getUTCHours();
  let utcMinute = now.getUTCMinutes();
  let utcDay = now.getUTCDay();

  // Round to nearest 30-minute slot to account for GitHub Actions scheduling delays
  if (utcMinute < 15) {
    utcMinute = 0;
  } else if (utcMinute < 45) {
    utcMinute = 30;
  } else {
    utcMinute = 0;
    utcHour = (utcHour + 1) % 24;
    if (utcHour === 0) utcDay = (utcDay + 1) % 7;
  }

  console.log(`[5] Checking for UTC Day=${utcDay} ${utcHour}:${utcMinute === 0 ? '00' : '30'}`);

  // ── Fetch all users ─────────────────────────────────────────────────────────
  let usersSnap;
  try {
    usersSnap = await db.collection('auth_users').get();
    console.log(`[6] Fetched ${usersSnap.size} user(s).`);
  } catch (e) {
    console.error('[!] Firestore read failed:', e.message);
    process.exit(1);
  }

  let successCount = 0;
  let failCount = 0;

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    if (!data.fcmToken || !data.pushPrefs || !data.pushPrefs.rules) continue;

    const matchingRules = data.pushPrefs.rules.filter((r) => {
      if (r.utcHour !== utcHour || r.utcMinute !== utcMinute) return false;
      if (r.type === 'weekly' && r.utcDayOfWeek !== utcDay) return false;
      return true;
    });

    for (const rule of matchingRules) {
      if (!rule.message) continue;
      const message = {
        notification: { title: 'Our Kitchen', body: rule.message },
        token: data.fcmToken,
        webpush: { fcmOptions: { link: 'https://moyyu0811-beep.github.io/our-kitchen/' } },
      };
      try {
        await admin.messaging().send(message);
        console.log(`[✓] Sent to ${userDoc.id} — "${rule.message}"`);
        successCount++;
      } catch (e) {
        console.error(`[✗] Failed for ${userDoc.id}:`, e.message);
        failCount++;
      }
    }
  }

  console.log(`[7] Done. Sent: ${successCount}, Failed: ${failCount}.`);
}

run()
  .then(() => {
    console.log('[8] Exiting cleanly.');
    process.exit(0);
  })
  .catch((e) => {
    console.error('[!] Unhandled error:', e);
    process.exit(1);
  });
