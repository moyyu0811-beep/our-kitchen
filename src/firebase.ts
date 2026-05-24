import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  projectId: "our-kitchen-bd036",
  appId: "1:997699688861:web:06f54ae3f6c237afba7774",
  storageBucket: "our-kitchen-bd036.firebasestorage.app",
  apiKey: "AIzaSyAFxz9fZ9O550rSyC7SDI9TPyYESqF4h_k",
  authDomain: "our-kitchen-bd036.firebaseapp.com",
  messagingSenderId: "997699688861",
  measurementId: "G-48T3BN0MGR"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
