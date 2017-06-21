# Demo Progressive web app, with optimised network delivery

## Priorities

- [ ] Test purging using surrogate keys

#### Loading scenarios

1. No serviceworker, online, full page response (Shift-reload)
  - Works for Fastly HIT, Works for Fastly MISS
2. No serviceworker, 304 Not modified (renavigate to the page with 'bypass for network')
  - Preventing this at the moment with no-store
3. Frag via serviceworker (clear cache -> click article)
4. Frag via serviceworker, 304 Not modified (click back to home, click article again)
5. Offline

## TODOs

- [ ] Add images (article.enclosures[0].url, .width)

## What this app demonstrates

- [x] Force TLS
- [x] SVGO

### Standard headers

- [x] CORS (VCL)
- [x] CSP (VCL)
- [x] HSTS and TLS redirect (VCL)
- [x] Frame options (VCL)
- [x] Serve-stale (VCL)
- [x] Referrer policy (VCL)

### Understand the cache

- [x] Output cache state info in a cookie (VCL)
- [x] Display cache state information (server.datacenter, fastly_info.state, time.elapsed.usec, req.http.X-Cache-Hits, req., Age, client.ip, server.ip, geo.latitude, geo.longitude, beresp.backend.ip)
- [x] Make client geo more accurate with geolocation API
- [x] Add Server Timing data in backend
- [x] Deal with 304 responses
- [x] Surface server timing data in UI
- [x] Fingerprint the static files
- [x] Don't cache surrogate-key-enhanced responses on the client-side
- [x] Bar visualisation
- [x] Surface object age, TTL, SWR and SIE times
- [x] Purge on content update
- [ ] Surface browser name and version

### Stream splicing in serviceworker

- [x] Use SW to intercept navigations and add ?frag=1
- [x] Serve fragments based on query param
- [x] Import header and footer templates into SW
- [x] Combine frags with header and footer using Streams in SW
- [ ] Navigation preload

### Offline mode

- [x] Display an offline frag if the frag we need is not available
- [x] Download articles for offline viewing into a dynamic cache
- [x] Update the dynamic cache every few hours

### Server push

- [x] Add link headers to any full page request
- [x] Make sure all Pushed resources are cachable
- [x] Remove the link headers in vcl_deliver (see Jake's H2 post)

### Purging

- [x] Add appropriate surrogate keys to all pages
- [x] Add button to hide an article for 20 mins (surrogate key purge)
- [x] Maintain a suppression list on the server
- [x] Send purge of surrogate keys

### PWA

- [ ] Add to home screen
- [ ] Online/offline indicator

### Push

- [ ] Silent push to sync new content


### Installation

1. Clone the repo
2. npm install
3. npm run start
4. In browser, open [http://localhost:3100](http://localhost:3100)
