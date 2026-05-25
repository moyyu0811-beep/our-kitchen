importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

const firebaseConfig = {
  projectId: "our-kitchen-bd036",
  appId: "1:997699688861:web:06f54ae3f6c237afba7774",
  storageBucket: "our-kitchen-bd036.firebasestorage.app",
  apiKey: "AIzaSyAFxz9fZ9O550rSyC7SDI9TPyYESqF4h_k",
  authDomain: "our-kitchen-bd036.firebaseapp.com",
  messagingSenderId: "997699688861",
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();
