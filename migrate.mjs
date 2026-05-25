// One-time migration script: stamp householdId: 'BBB10' on all legacy Firestore documents
// Run with: node migrate.mjs

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "our-kitchen-bd036",
  appId: "1:997699688861:web:06f54ae3f6c237afba7774",
  storageBucket: "our-kitchen-bd036.firebasestorage.app",
  apiKey: "AIzaSyAFxz9fZ9O550rSyC7SDI9TPyYESqF4h_k",
  authDomain: "our-kitchen-bd036.firebaseapp.com",
  messagingSenderId: "997699688861",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const HID = 'BBB10';

async function stampCollection(collName) {
  const snap = await getDocs(collection(db, collName));
  const batch = writeBatch(db);
  let count = 0;
  for (const d of snap.docs) {
    if (!d.data().householdId) {
      batch.update(d.ref, { householdId: HID });
      count++;
    }
  }
  if (count > 0) await batch.commit();
  console.log(`${collName}: stamped ${count} docs`);
}

async function migrateCalendar() {
  const snap = await getDocs(collection(db, 'calendar'));
  const batch = writeBatch(db);
  let created = 0;
  let skipped = 0;
  for (const d of snap.docs) {
    const oldId = d.id;
    const data = d.data();
    // If already has BBB10_ prefix or householdId field, skip
    if (oldId.startsWith(`${HID}_`) || data.householdId) {
      // Just ensure householdId field is set
      if (!data.householdId) batch.update(d.ref, { householdId: HID });
      skipped++;
      continue;
    }
    // Create new doc with BBB10_ prefix
    const newId = `${HID}_${oldId}`;
    const newRef = doc(db, 'calendar', newId);
    batch.set(newRef, { ...data, householdId: HID });
    // Delete old doc
    batch.delete(d.ref);
    created++;
  }
  if (created > 0 || skipped > 0) await batch.commit();
  console.log(`calendar: created ${created} new docs, updated ${skipped} existing`);
}

async function main() {
  console.log('Starting migration for household:', HID);
  await stampCollection('menu');
  await stampCollection('users');
  await stampCollection('grocery_list');
  await stampCollection('inventory');
  await stampCollection('purchase_history');
  await migrateCalendar();
  console.log('Migration complete!');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
