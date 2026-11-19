/* HUIZE SHOP - Web Push Notification Handler (imported by Workbox SW & standalone fallback) */

self.addEventListener('push', function (event) {
  if (!event.data) return;

  var payload = {};
  try {
    payload = event.data.json();
  } catch (e) {
    payload = {
      title: 'HUIZE SHOP',
      body: event.data.text()
    };
  }

  var title = payload.title || 'HUIZE SHOP';
  var options = {
    body: payload.body || 'Vous avez reçu un nouveau message.',
    icon: payload.icon || '/pwa-192x192.png',
    badge: payload.badge || '/pwa-192x192.png',
    tag: payload.tag || 'huize-shop-chat',
    renotify: true,
    vibrate: [180, 90, 180],
    data: {
      url: payload.url || '/'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var targetUrl = (event.notification && event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      var fullTarget = new URL(targetUrl, self.location.origin).href;
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url && 'focus' in client) {
          if (client.navigate) {
            return client.navigate(fullTarget).then(function (navigated) {
              return navigated ? navigated.focus() : client.focus();
            }).catch(function () {
              return client.focus();
            });
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(fullTarget);
      }
      return undefined;
    })
  );
});
