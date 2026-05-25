const admin = require('firebase-admin');

// Parse the service account from the environment variable
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
  const isMorning = process.argv.includes('--morning');
  const isEvening = process.argv.includes('--evening');
  
  if (!isMorning && !isEvening) {
    console.error("Please specify --morning or --evening");
    process.exit(1);
  }

  const usersSnap = await db.collection('auth_users').get();
  
  let successCount = 0;
  let failCount = 0;

  for (const doc of usersSnap.docs) {
    const data = doc.data();
    if (data.fcmToken) {
      const prefs = data.pushPrefs || {};
      
      let title = "Our Kitchen";
      let body = "";
      
      if (isMorning && prefs.morning) {
        body = prefs.morning.msg || "今天吃什么？";
      } else if (isEvening && prefs.evening) {
        body = prefs.evening.msg || "明天吃什么？";
      }
      
      if (body) {
        const message = {
          notification: { title, body },
          token: data.fcmToken,
          webpush: {
            fcmOptions: {
              link: 'https://moyyu.github.io/our-kitchen/'
            }
          }
        };
        
        try {
          await admin.messaging().send(message);
          successCount++;
        } catch (error) {
          console.error(`Failed to send to ${doc.id}:`, error.message);
          failCount++;
        }
      }
    }
  }
  
  console.log(`Sent ${successCount} notifications. Failed: ${failCount}`);
}

run().catch(console.error);
