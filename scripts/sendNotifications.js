const admin = require('firebase-admin');
console.log('[1] Script started. Node version:', process.version);


let serviceAccount;
try {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.error('[!] FIREBASE_SERVICE_ACCOUNT is not set.');
    process.exit(1);
  }
  serviceAccount = JSON.parse(raw);
  console.log('[2] Service account parsed. Project ID:', serviceAccount.project_id);
} catch (e) {
  console.error('[!] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', e.message);
  process.exit(1);
}

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('[3] Firebase Admin initialized.');
} catch (e) {
  console.error('[!] Firebase Admin initializeApp failed:', e.message);
  process.exit(1);
}

const db = admin.firestore();
console.log('[4] Firestore instance created.');

async function run() {
  const now = new Date();
  let utcHour = now.getUTCHours();
  let utcMinute = now.getUTCMinutes();
  let utcDay = now.getUTCDay();

  // Round to nearest 30 minute interval to account for GitHub Actions scheduling delays
  if (utcMinute < 15) {
    utcMinute = 0;
  } else if (utcMinute < 45) {
    utcMinute = 30;
  } else {
    utcMinute = 0;
    utcHour += 1;
    if (utcHour >= 24) {
      utcHour = 0;
      utcDay = (utcDay + 1) % 7;
    }
  }

  console.log(`[5] Checking rules for UTC time: Day ${utcDay}, ${utcHour}:${utcMinute === 0 ? '00' : '30'}`);

  let usersSnap;
  try {
    usersSnap = await db.collection('auth_users').get();
    console.log(`[6] Fetched ${usersSnap.size} user(s) from auth_users.`);
  } catch (e) {
    console.error('[!] Failed to read auth_users from Firestore:', e.message);
    process.exit(1);
  }
  
  let successCount = 0;
  let failCount = 0;

  for (const doc of usersSnap.docs) {
    const data = doc.data();
    if (data.fcmToken && data.pushPrefs && data.pushPrefs.rules) {
      const rules = data.pushPrefs.rules;
      
      // Find rules that match the current UTC time block
      const matchingRules = rules.filter(r => {
        if (r.utcHour !== utcHour || r.utcMinute !== utcMinute) return false;
        if (r.type === 'weekly' && r.utcDayOfWeek !== utcDay) return false;
        return true;
      });

      for (const rule of matchingRules) {
        if (rule.message) {
          const message = {
            notification: { title: "Our Kitchen", body: rule.message },
            token: data.fcmToken,
            webpush: {
              fcmOptions: {
                link: 'https://moyyu.github.io/our-kitchen/'
              }
            }
          };
          
          try {
            await admin.messaging().send(message);
            console.log(`Sent notification to ${doc.id} for rule ${rule.id}`);
            successCount++;
          } catch (error) {
            console.error(`Failed to send to ${doc.id}:`, error.message);
            failCount++;
          }
        }
      }
    }
  }
  
  console.log(`[7] Finished. Sent: ${successCount}, Failed: ${failCount}.`);
}

run().then(() => {
  console.log('[8] Done. Exiting cleanly.');
  process.exit(0);
}).catch(e => {
  console.error('[!] Unhandled error in run():', e);
  process.exit(1);
});
