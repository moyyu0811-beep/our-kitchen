const admin = require('firebase-admin');

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : null;

if (!serviceAccount) {
  console.error("Missing FIREBASE_SERVICE_ACCOUNT environment variable");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

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

  console.log(`Checking rules for UTC time: Day ${utcDay}, ${utcHour}:${utcMinute === 0 ? '00' : '30'}`);

  const usersSnap = await db.collection('auth_users').get();
  
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
  
  console.log(`Finished sending. Success: ${successCount}. Failed: ${failCount}`);
}

run().catch(console.error);
