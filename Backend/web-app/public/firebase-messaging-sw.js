// Firebase Cloud Messaging Service Worker (Trimmy SaaS)
// Gestisce le notifiche Push inviate via Firebase Cloud Messaging o dalla Firebase Console

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAdfL_QFoUFLqCK-H1rdkAdzCLworsZfOY",
  authDomain: "gestionale-saloni.firebaseapp.com",
  projectId: "gestionale-saloni",
  storageBucket: "gestionale-saloni.firebasestorage.app",
  messagingSenderId: "274369523001",
  appId: "1:274369523001:web:9c1fece3391c222977cce8"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Notifica push in background ricevuta:', payload);
  
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Trimmy Notifica';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.message || '',
    icon: '/favicon.ico',
    image: payload.notification?.image || payload.notification?.imageUrl,
    badge: '/favicon.ico',
    data: {
      url: payload.data?.clickAction || payload.data?.url || '/',
      ...payload.data
    }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
