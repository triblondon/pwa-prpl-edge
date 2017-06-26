importScripts('/js/sw/merge-responses.js');
importScripts('/js/sw/idb-keyval.js');

function promiseTimer(duration, resolution) {
  return new Promise((resolve, reject) => {
    setTimeout((resolution === 'resolve') ? resolve : reject, duration);
  });
}

function parseServerTiming(str) {
  return str
    .split(/\s*,\s*/)
    .reduce((out, segment) => {
      const [k, v] = segment.split(/\s*[=;]\s*/, 2);
      const decoded = decodeURIComponent(v);
      if (/^\-?\d+(\.\d+)?$/.test(decoded)) {
        out[k] = parseFloat(decoded);
      } else if (/^\(?null\)?$/.test(decoded)) {
        out[k] = null;
      } else if (decoded.toLowerCase() === 'true') {
        out[k] = true;
      } else if (decoded.toLowerCase() === 'false') {
        out[k] = false;
      } else {
        out[k] = decoded;
      }
      return out;
    }, {})
  ;
}

const NETWORK_TIMEOUT_SHORT = 1 * 1000;
const NETWORK_TIMEOUT_LONG = 5 * 1000;
const DYNAMIC_CACHE_UPDATE_INTERVAL = (location.hostname === 'localhost') ? (10 * 1000) : (60 * 60 * 1000);
const FRAG_PAGE_PATTERN = /^\/((articles|topics)\/)?/;
const NOCACHE_URL_PATTERN = /^https?\:\/\/www\.google\-analytics\.com(\/r)?\/collect/;

const responseMetaData = new Map();
let cacheUpdateInProgress = false;

// Adding `install` event listener
self.addEventListener('install', event => {
  console.log('[SW] Install');

  event.waitUntil(async function () {
    try {
      const oldCacheID = await idbKeyval.get('cacheID');
      const newCacheID = (oldCacheID || 0) + 1;
      await idbKeyval.set('cacheID', newCacheID);
      await idbKeyval.set('dynamicCacheUpdateTime', 0);
      const cache = await caches.open('v'+newCacheID+'-static');
      await cache.addAll([
        '/shell/fragments/header',
        '/shell/fragments/footer',
        '/shell/offline',
        '/js/sw/merge-responses.js',
        '/js/sw/idb-keyval.js'
      ]);
      console.info('[SW] New cache ID is '+newCacheID);
      return self.skipWaiting();
    } catch (e) {
      console.error('[SW] Failed to build SW cache', e);
    }
  }());
});

self.addEventListener('fetch', event => {
  const fragUrl = new URL(event.request.url);
  fragUrl.searchParams.set('frag', 1);
  const useFrag = (event.request.mode === 'navigate' && FRAG_PAGE_PATTERN.test(event.request.url));
  const fetchReq = useFrag ? new Request(fragUrl.toString(), { mode: 'cors', credentials: 'include' }) : event.request;

  // Disable serviceworker for event streams
  if (event.request.headers.get('Accept') === 'text/event-stream') {
    return undefined;
  }

  // If the performance timings buffer fills up, no more perf data will be recorded.  Clear it on each navigation to ensure we don't hit the limit.
  if (event.request.mode === 'navigate') {
    responseMetaData.clear();
    self.performance.clearResourceTimings();
    if ('clearServerTimings' in self.performance) {
      self.performance.clearServerTimings();
    }
  }

  // Cache-first for shell, network-first for content
  event.respondWith(async function () {
    const cacheID = await idbKeyval.get('cacheID');
    const staticCache = await caches.open('v'+cacheID+'-static');
    const dynamicCache = await caches.open('v'+cacheID+'-dynamic');

    const contentRespPromise = Promise.resolve(undefined)

      // Pending preloadResponse if it exists (could be frag or not)
      //.then(r => r || Promise.resolve(event.preloadResponse))

      // Failing that, try static cache lookups (which should only apply if not a page navigation)
      .then(r => r || (function() {
        if (event.request.mode !== 'navigate') {
          return Promise.all([
            staticCache.match(event.request.url),
            staticCache.match(fragUrl.toString())
          ]).then(([r1, r2]) => {
            const r = r1 || r2;
            if (r) return [r, 'swStaticCache'];
          });
        }
      }()))

      // Failing that, try the network if online (but use dynamic cache if network is unavailable or slow)
      .then(r => r || (function () {
        const cacheFetchPromise = dynamicCache.match(fetchReq).then(r => [r, 'swCache']);
        if (navigator.onLine) {
          const netFetchPromise = fetch(fetchReq).then(resp => {

            // Pick up any static assets that should be cached eg fonts, images, CSS, JS
            const ccHeader = resp.headers.get('cache-control');
            const isUncacheable = NOCACHE_URL_PATTERN.test(fetchReq.url) || (ccHeader && ccHeader.includes('no-store'));
            if (event.request.mode !== 'navigate' && !isUncacheable) {
              console.log('Adding '+fetchReq.url+' to static cache');
              staticCache.put(fetchReq, resp.clone());
            }
            return [resp, 'network'];
          });
          return Promise.resolve()
            .then(() => Promise.race([netFetchPromise, promiseTimer(NETWORK_TIMEOUT_SHORT, 'reject')]))
            .catch(() => Promise.race([netFetchPromise, cacheFetchPromise, promiseTimer(NETWORK_TIMEOUT_LONG, 'reject')]))
          ;
        } else {
          return cacheFetchPromise;
        }
      }()))

      .then(r => {
        if (!r) throw new Error('No response available');
        const [resp, source] = r;
        const useServerTiming = (source === 'network' && resp.headers.get('Server-Timing'));
        responseMetaData.set(fetchReq.url, useServerTiming ? parseServerTiming(resp.headers.get('Server-Timing')) : {source:source});
        return resp;
      })

      .catch(err => {
        if (!navigator.onLine) {
          console.log("[SW] Fetch fail for "+fetchReq.url, fetchReq, err);
        }
        if (event.request.mode === 'navigate') {
          return caches.match('/shell/offline');
        } else {
          return new Response('', {status: 503, statusText: 'Offline from SW'});
        }
      })
    ;

    if (!useFrag) {
      return contentRespPromise;
    } else {

      // Construct a full page if the response was a frag
      const head = staticCache.match('/shell/fragments/header');
      const foot = staticCache.match('/shell/fragments/footer');
      const mergedResp = mergeResponses([head, contentRespPromise, foot], {'content-type':'text/html'});
      console.log('[SW] Merging frag for ' + fetchReq.url);

      // TODO: Why does this error with 'event is already finished'
      //event.waitUntil(mergedResp.done);

      return mergedResp.response;
    }

  }());


  // Update dynamic cache if needed
  if (!cacheUpdateInProgress && navigator.onLine && event.request.mode === 'navigate') {
    (async () => {
      const lastUpdateTime = await idbKeyval.get('dynamicCacheUpdateTime');
      if (!lastUpdateTime || lastUpdateTime < (Date.now() - DYNAMIC_CACHE_UPDATE_INTERVAL)) {
        console.log('[SW] Updating dynamic cache...');
        cacheUpdateInProgress = true;
        const cacheID = await idbKeyval.get('cacheID');
        const cache = await caches.open('v'+cacheID+'-dynamic');
        const newUrlList = await fetch("/shell/files/dynamic").then(resp => resp.json());
        const existingUrlList = await cache.keys().then(reqs => reqs.map(r => r.url.replace(/https?\:\/\/[^\/]+/, '')));
        const urlsToAdd = newUrlList.filter(u => !existingUrlList.includes(u));
        const urlsToDel = existingUrlList.filter(u => !newUrlList.includes(u));
        await Promise.all(urlsToDel.map(u => cache.delete(u)).concat(cache.addAll(urlsToAdd)));
        await idbKeyval.set('dynamicCacheUpdateTime', Date.now());
        console.log("[SW] Dynamic cache update complete.  Deletions: "+urlsToDel.length+", additions: "+urlsToAdd.length);
        cacheUpdateInProgress = false;
      }
    })();
  }
});


self.addEventListener('activate', (event) => {
  console.log('[SW] Activating new service worker');

  // Enable Navigation preload if it is available
  //if (self.registration.navigationPreload) {
  //  console.log('[SW] NavigationPreload enabled');
  //  self.registration.navigationPreload.enable();
  //}

  // Remove outdated caches
  event.waitUntil(async function() {
    const cacheID = await idbKeyval.get('cacheID');
    const cachePrefix = 'v'+cacheID;
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(existingCacheName => {
      if (!existingCacheName.startsWith(cachePrefix)) {
        console.log("[SW] Deleted outdated cache called " + existingCacheName);
        return caches.delete(existingCacheName);
      }
    }));

    // Activate current one instead of waiting for the old one to finish
    return self.clients.claim();
  }());
});

self.addEventListener('message', function(event) {
  if (event.data.name === 'getRespMeta') {

    const fragUrl = new URL(event.data.data.url);
    fragUrl.searchParams.set('frag', 1);

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
    responseMetaData.delete(fragUrl.toString());

    event.ports[0].postMessage({status:'ok', data: combinedData});

  } else {
    event.ports[0].postMessage({status:'error', data: { message: 'No such method name' }});
  }

});
