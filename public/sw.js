/* TapSheet push service worker.
 * Handles incoming Web Push messages and click-through navigation. Kept
 * dependency-free so it can be served as a static file from /sw.js. */

self.addEventListener("install", (event) => {
  // Activate this worker immediately rather than waiting for old tabs to close.
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (err) {
    data = { title: "TapSheet", body: event.data ? event.data.text() : "" }
  }

  const title = data.title || "TapSheet"
  const options = {
    body: data.body || "",
    icon: "/beeserv-icon.png",
    badge: "/beeserv-icon.png",
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { href: data.href || "/" },
    vibrate: [100, 50, 100],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const href = (event.notification.data && event.notification.data.href) || "/"

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus an existing tab if one is open, otherwise open a new one.
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(href)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(href)
    }),
  )
})
