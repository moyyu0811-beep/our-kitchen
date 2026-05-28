/**
 * sendTest.cjs  —  run manually to fire a real FCM notification immediately
 * Usage: FIREBASE_SERVICE_ACCOUNT='...' node scripts/sendTest.cjs
 */
const admin = require('firebase-admin');

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : null;

if (!serviceAccount) {
  console.error('Set FIREBASE_SERVICE_ACCOUNT env var first.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const usersSnap = await db.collection('auth_users').get();
  console.log(`Found ${usersSnap.size} user(s).`);

  let sent = 0, failed = 0, skipped = 0;

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    if (!data.fcmToken) {
      console.log(`  [skip] ${userDoc.id} — no fcmToken`);
      skipped++;
      continue;
    }

    console.log(`  [send] ${userDoc.id} — token: ${data.fcmToken.slice(0, 20)}...`);
    try {
      await admin.messaging().send({
        notification: { title: 'Our Kitchen 🍳', body: 'Test notification — it works!' },
        token: data.fcmToken,
        webpush: { fcmOptions: { link: 'https://moyyu0811-beep.github.io/our-kitchen/' } },
      });
      console.log(`  [✓] Sent!`);
      sent++;
    } catch (e) {
      console.error(`  [✗] Failed:`, e.message);
      failed++;
    }
  }

  console.log(`\nDone. Sent: ${sent}, Failed: ${failed}, Skipped (no token): ${skipped}`);
}

run().catch(e => { console.error(e); process.exit(1); });
