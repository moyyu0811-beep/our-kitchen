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

// Show notification when app is in the background or closed
messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification ?? {};
  const link = payload.webpush?.fcmOptions?.link ?? '/';

  self.registration.showNotification(title ?? 'Our Kitchen', {
    body: body ?? '',
    icon: '/our-kitchen/icons/icon-192.png',
    badge: '/our-kitchen/icons/icon-192.png',
    data: { link },
  });
});

// Open the app when notification is tapped
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const link = event.notification.data?.link ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes('our-kitchen') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(link);
    })
  );
});
