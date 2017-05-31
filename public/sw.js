importScripts('/js/sw/handlebars-runtime.js');
importScripts('/js/sw/merge-responses.js');
importScripts('/shell');

const cacheName = 'cache-v7';
const corsHosts = [
  'freegeoip.net',
  location.host
];

// Files to save in cache (TODO: Can we send an 'accept-fragment' header here to avoid the querystring param and enable Vary?)
const staticFiles = [

  './?frag=1',
  './offline',
  'https://fonts.googleapis.com/css?family=Raleway:300,400,500,600,700',
  './css/styles.css',
  './css/ux-platform.css',
  './js/net-info.js',
  './js/purge.js',
  './js/analytics.js',
  './images/icons/16x16.png',
  './images/icons/32x32.png',
  './images/icons/laptop.svg',
  './images/icons/fastly.svg',
  './images/icons/server.svg',
  './images/fastly-logo.svg',
  './images/guardian-logo.svg',
  './manifest.json'
];

const perfData = {};

// Adding `install` event listener
self.addEventListener('install', (event) => {
  console.log('[SW] Install');

  event.waitUntil(
    caches.open(cacheName)
    .then((cache) => {
      return cache.addAll(staticFiles)
      .then(() => {
        console.info('[SW] Caching complete');

        // Force the waiting service worker to become the active service worker
        return self.skipWaiting();
      })
      .catch((error) =>  {
        console.error('[SW] Failed to build SW cache', error);
      })
    })
  );
});

self.addEventListener('fetch', event => {
  const fragUrl = new URL(event.request.url);
  fragUrl.searchParams.set('frag', 1);
  const fetchReq = (!corsHosts.includes(fragUrl.host)) ? event.request : new Request(fragUrl.toString(), { mode: 'cors' });

  const responsePromise = Promise.resolve()
    .then(() => caches.match(event.request.url))       // Full page match in static cache
    .then(r => r || caches.match(fragUrl.toString()))  // Frag match in static cache
    .then(r => r || event.preloadResponse)             // Pending preloadResponse (could be frag or not)
    .then(r => r || fetch(fetchReq))                   // Fall back to fetch, allow server to send frag if it wants to
    .then(r => {
      //console.log('[SW] Fetch', fetchReq, r);
      if (r.headers.get('Fragment')) {                 // If the server sent a frag, merge it with header/footer
        const mergedResp = mergeResponses([
          new Response(Handlebars.templates.header(), {}),
          r,
          new Response(Handlebars.templates.footer(), {})
        ], r.headers);
        console.log('[SW] Merging frag for ' + r.url);
        return mergedResp;
      } else {
        return r;
      }
    })
    .catch(err => {
      console.log("[SW] Fetch fail for "+event.request.url, err.message);
      return caches.match('/offline');
    })
  ;

  // Use a cache-first strategy
  event.respondWith(responsePromise);
});


self.addEventListener('activate', (event) => {
  console.log('[SW] Activating new service worker');

  // Enable Navigation preload if it is available
  //if (self.registration.navigationPreload) {
  //  console.log('[SW] NavigationPreload enabled');
  //  self.registration.navigationPreload.enable();
  //}

  // Remove outdated caches
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames.map(existingCacheName => {
          if (existingCacheName !== cacheName) {
            console.log("[SW] Deleted outdated cache called " + existingCacheName);
            return caches.delete(existingCacheName);
          }
        })
      ))
      .then(() => {
        // Activate current one instead of waiting for the old one to finish
        return self.clients.claim();
      })
  );
});

/*
self.addEventListener('push', (event) => {
  console.info('[SW] Received push');

  var title = 'Push notification demo';
  var body = {
    'body': 'click to return to application',
    'tag': 'demo',
    'icon': './images/icons/192x192.png',
    'badge': './images/icons/192x192.png',
    //Custom actions buttons
    'actions': [
      { 'action': 'yes', 'title': 'Yes'},
      { 'action': 'no', 'title': 'No'}
    ]
  };

  event.waitUntil(self.registration.showNotification(title, body));
});

self.addEventListener('notificationclick', event => {

  // TODO: Can this be detected from location.hostname?
  console.log('[SW] Notification click', location.hostname);
  const appBaseUrl = 'https://pwa.fastlydemo.net/';

  // Listen to custom action buttons in push notification
  if (event.action === 'yes') {
    console.log('[SW] Notification click: yes');
  }
  else if (event.action === 'no') {
    console.warn('[SW] Notification click: no');
  }

  event.notification.close();

  // If the site is already open in a tab, focus the tab.  If not, open a new tab.
  event.waitUntil(
    clients.matchAll({type: 'window'})
    .then(clients => {
      for (var i = 0; i < clients.length; i++) {
        const client = clients[i];
        if (client.url.startsWith(appBaseUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
    .catch((error) => {
      console.error(error);
    })
  );
});
*/

/*
  BACKGROUND SYNC EVENT: triggers after `bg sync` registration and page has network connection.
  It will try and fetch github username, if its fulfills then sync is complete. If it fails,
  another sync is scheduled to retry (will will also waits for network connection)
*/
/*
self.addEventListener('sync', (event) => {
  console.info('Event: Sync');

  // Check registered sync name or emulated sync from devTools
  if (event.tag === 'github' || event.tag === 'test-tag-from-devtools') {
    event.waitUntil(
      //To check all opened tabs and send postMessage to those tabs
      self.clients.matchAll().then((all) => {
        return all.map((client) => {
          return client.postMessage('online'); //To make fetch request, check app.js - line no: 122
        })
      })
      .catch((error) => {
        console.error(error);
      })
    );
  }
});
*/

self.addEventListener('message', function(event) {
  console.log('[SW] Message', event.data);
  if (event.data.name === 'getPerfEntries') {

    const fragUrl = new URL(event.data.data.url);
    fragUrl.searchParams.set('frag', 1);

    // Use frag URL here
    const entries = self.performance.getEntriesByName(fragUrl.toString());
    console.log('entries', fragUrl.toString(), entries);

    // Get latest resource perf entry
    // TODO: hacky. See https://developers.google.com/web/updates/2015/07/measuring-performance-in-a-service-worker?google_comment_id=z13mv5i4vw31gjpii04cjh4rhufuzfob34w
    // TODO: No servertiming available in this context?
    const latestResourceEntry = entries.filter(entry => entry.entryType = 'resource').pop();

    // JSON dance here otherwise we get an error about not being able to clone
    const plainData = latestResourceEntry ? JSON.parse(JSON.stringify(latestResourceEntry)) : null;

    // Clear resource timings to prevent buffer overflow
    self.performance.clearResourceTimings();
    if ('clearServerTimings' in self.performance) {
      self.performance.clearServerTimings();
    }

    event.ports[0].postMessage({status:'ok', data: plainData});

  } else {
    event.ports[0].postMessage({status:'error', data: { message: 'No such method name' }});
  }

});
