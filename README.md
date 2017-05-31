# Demo Progressive web app, with optimised network delivery

- [ ] Add images (article.enclosures[0].url, .width)

## What this app demonstrates

- [ ] Force TLS
- [x] SVGO

### Standard headers

[x] CORS (VCL)
[x] CSP (VCL)
[x] HSTS and TLS redirect (VCL)
[x] Frame options (VCL)
[x] Serve-stale (VCL)

### Understand the cache

[x] Output cache state info in a cookie (VCL)
[x] Display cache state information (server.datacenter, fastly_info.state, time.elapsed.usec, req.http.X-Cache-Hits, req., Age, client.ip, server.ip, geo.latitude, geo.longitude, beresp.backend.ip)
[x] Make client geo more accurate with geolocation API
[x] Add Server Timing data in backend
[x] Deal with 304 responses
[ ] Surface server timing data in UI
[ ] Fingerprint the static files
[x] Don't cache surrogate-key-enhanced responses on the client-side

### Stream splicing in serviceworker

[x] Use SW to intercept navigations and add ?frag=1
[x] Serve fragments based on query param
[x] Import header and footer templates into SW
[x] Combine frags with header and footer using Streams in SW
[ ] Navigation preload

### Offline mode

[x] Display an offline frag if the frag we need is not available
[ ] Download articles for offline viewing into a dynamic cache

### Server push

[ ] Add link headers to any full page request
[ ] Make sure all Pushed resources are cachable

### Purging

[x] Add appropriate surrogate keys to all pages
[x] Add button to hide an article for 20 mins (surrogate key purge)
[x] Maintain a suppression list on the server
[x] Send purge of surrogate keys
[ ] Surface the number of pages purged

### PWA

[ ] Add to home screen
[ ] Online/offline indicator

### Push

[ ] Silent push


### Installation

1. Clone the repo
2. npm install
3. npm run start
4. In browser, open [http://localhost:3100](http://localhost:3100)
