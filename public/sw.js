importScripts('/js/sw/merge-responses.js');

function promiseTimer(duration, resolution) {
  return new Promise ((resolve, reject) => {
    setTimeout((resolution === 'resolve') ? resolve : reject, duration);
  });
}

const NETWORK_TIMEOUT_SHORT = 1000;
const NETWORK_TIMEOUT_LONG = 5000;
const CACHE_NAME = 'v8';

const responseMetaData = new Map();

// Adding `install` event listener
self.addEventListener('install', (event) => {
  console.log('[SW] Install');

  event.waitUntil(
    Promise.all([
      fetch("/shell/files/dynamic")
        .then(resp => resp.json())
        .then(urlList => caches.open(CACHE_NAME+'-dynamic').then(cache => cache.addAll(urlList)).then(() => urlList.length))
      ,
      fetch("/shell/files/static")
        .then(resp => resp.json())
        .then(urlList => caches.open(CACHE_NAME+'-static').then(cache => cache.addAll(urlList)).then(() => urlList.length))
    ])
    .then(([dynamicLen, staticLen]) => {
      console.info('[SW] Shell caching complete.  Static: '+staticLen+', dynamic: '+dynamicLen);

      // Force the waiting service worker to become the active service worker
      return self.skipWaiting();
    })
    .catch((error) =>  {
      console.error('[SW] Failed to build SW cache', error);
    })
  );
});

self.addEventListener('fetch', event => {
  const fragUrl = new URL(event.request.url);
  fragUrl.searchParams.set('frag', 1);
  const fetchReq = (event.request.mode === 'navigate') ? new Request(fragUrl.toString(), { mode: 'cors', credentials: 'include' }) : event.request;

  // If the performance timings buffer fills up, no more perf data will be recorded.  Clear it on each navigation to ensure we don't hit the limit.
  if (event.request.mode === 'navigate') {
    responseMetaData.clear();
    self.performance.clearResourceTimings();
    if ('clearServerTimings' in self.performance) {
      self.performance.clearServerTimings();
    }
  }

  // Cache-first for shell, network-first for content
  const responsePromise = Promise.all([caches.open(CACHE_NAME+'-static'), caches.open(CACHE_NAME+'-dynamic')])
    .then(([staticCache, dynamicCache]) => Promise.resolve()

      // Pending preloadResponse if it exists (could be frag or not)
      .then(event.preloadResponse)

      // Failing that, try static cache lookups (which should only apply if not a page navigation)
      .then(r => r ||
        Promise.all([
          staticCache.match(event.request.url),
          staticCache.match(fragUrl.toString())
        ]).then(([r1, r2]) => r1 || r2)
      )

      // Failing that, try the network (but use dynamic cache if network is unavailable or slow)
      .then(r => {
          if (r) return r;
          const netFetch = fetch(fetchReq);
          const cacheFetch = dynamicCache.match(fetchReq).then(r => {
            if (r) {
              responseMetaData.set(fetchReq.url, {source:'swCache'});
            }
            return r;
          });
          return Promise.resolve()
            .then(() => Promise.race([netFetch, promiseTimer(NETWORK_TIMEOUT_SHORT, 'reject')]))
            .catch(() => Promise.race([netFetch, cacheFetch, promiseTimer(NETWORK_TIMEOUT_LONG, 'reject')]))
          ;
      })

      // Process response: construct a full page if the response was a frag
      .then(r => {
        if (!r) throw new Error('No response available');
        //console.log('[SW] Fetch', fetchReq, r);
        if (r.headers.get('Fragment')) {
          const head = staticCache.match('/shell/fragments/header');
          const foot = staticCache.match('/shell/fragments/footer');
          const mergedResp = mergeResponses([head, r, foot], r.headers);
          console.log('[SW] Merging frag for ' + fetchReq.url);
          event.waitUntil(mergedResp.done);
          return mergedResp.response;
        } else {
          return r;
        }
      })
    )
    .catch(err => {
      if (event.request.mode === 'navigate') {
        return caches.match('/shell/offline');
      } else {
        console.log("[SW] Fetch fail for "+fetchReq.url, err.message);
        return new Response('', {status: 503, statusText: 'Offline'});
      }
    })
  ;

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
          if (!existingCacheName.startsWith(CACHE_NAME)) {
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

    // Get latest resource perf entry (there should only be one, if buffer is cleared on navigate)
    // TODO: hacky. See https://developers.google.com/web/updates/2015/07/measuring-performance-in-a-service-worker?google_comment_id=z13mv5i4vw31gjpii04cjh4rhufuzfob34w
    // TODO: No servertiming available in this context?
    const latestResourceEntry = entries.filter(entry => entry.entryType = 'resource').pop();

    // JSON dance here otherwise we get an error about not being able to clone
    const timingData = latestResourceEntry ? JSON.parse(JSON.stringify(latestResourceEntry)) : {};

    // Merge any data from the response metadata map
    const respData = responseMetaData.get(fragUrl.toString()) || {};
    const combinedData = Object.assign(timingData, respData);

    event.ports[0].postMessage({status:'ok', data: combinedData});

  } else {
    event.ports[0].postMessage({status:'error', data: { message: 'No such method name' }});
  }

});
