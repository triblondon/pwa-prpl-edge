# Demo Progressive web app, with optimised network delivery

This is an example of a [progressive web app](https://developers.google.com/web/progressive-web-apps/) which demonstrates and utilises features of Fastly to make for a highly optimised PWA experience.

## TODOs

This is a list of next steps, culled from the larger list below of features that this app demonstrates.

- Highlight new articles
- Show toast when new articles are available
- Add images (article.enclosures[0].url, .width)
- Option to serve an empty view and render client-side

## Features

### Standard headers

All of these are added in VCL using VCL snippets.

- [x] CORS (VCL)
- [x] CSP (VCL)
- [x] HSTS and TLS redirect (VCL)
- [x] Frame options (VCL)
- [x] Serve-stale (VCL)
- [x] Referrer policy (VCL)
- [ ] Combine into origin policy

### Understand the cache

Exposed in `Server-Timing` header sent from VCL. See new [Server timing API](https://w3c.github.io/server-timing/).

- [x] Output cache state info in a cookie (VCL)
- [x] Display cache state information (server.datacenter, fastly_info.state, time.elapsed.usec, req.http.X-Cache-Hits, req., Age, client.ip, server.ip, geo.latitude, geo.longitude, beresp.backend.ip)
- [x] Make client geo more accurate with geolocation API
- [x] Add Server Timing data in backend
- [x] Deal with 304 responses
- [x] Surface server timing data in UI
- [x] Fingerprint the static files
- [x] Don't cache surrogate-key-enhanced responses on the client-side
- [x] Bar chart visualisation
- [x] Surface object age, TTL, SWR and SIE times
- [x] Purge on content update
- [ ] Surface browser name and version

### Stream splicing in serviceworker

Uses new [Web Streams](https://jakearchibald.com/2016/streams-ftw/)

- [x] Use SW to intercept navigations and add ?frag=1
- [x] Serve fragments based on query param
- [x] Import header and footer templates into SW
- [x] Combine frags with header and footer using Streams in SW
- [ ] Navigation preload

### Offline mode

PWAs deliver meaningful experiences while offline.

- [x] Display an offline frag if the frag we need is not available
- [x] Download articles for offline viewing into a dynamic cache
- [x] Update the dynamic cache every few hours
- [ ] Visual indication of whether the user is offline

### Server push

Origins can prompt Fastly to [push assets over an HTTP/2 connection using Link headers](https://docs.fastly.com/guides/performance-tuning/http2-server-push)

- [x] Add link headers to any full page request
- [x] Make sure all Pushed resources are cachable
- [x] Remove the link headers in vcl_deliver (see Jake's H2 post)

### Purging

Fastly can purge globally in 200ms, and also offers [surrogate key tagging](https://docs.fastly.com/guides/purging/getting-started-with-surrogate-keys) to make this even more powerful.

- [x] Add appropriate surrogate keys to all pages
- [x] Add button to hide an article for 20 mins (surrogate key purge)
- [x] Maintain a suppression list on the server
- [x] Send purge of surrogate keys

### PWA

The only technology that is unique to PWAs (and introduced for their benefit) is the home screen install prompt, but PWAs also require the presence of a Web App manifest.

- [ ] Add to home screen
- [x] Web app manifest

### Push

Fastly supports [Server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) for real time, low latency event notifications to the browser.  Serviceworker also provides access to [Web Push](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) for subscriptions that outlive the browser session.

- [ ] Server-sent events stream to notify user of new or updated content in real time (WIP)
- [ ] Silent push to sync new content


### Installation

1. Clone the repo
2. `npm install`
3. `npm run start-dev` or for production mode, `npm start`.
4. In browser, open [http://localhost:3100](http://localhost:3100)

You also need a Fastly service set up, and to set your `FASTLY_API_TOKEN` and `FASTLY_SERVICE_ID` into the environment.  Speak to support and we'll help you get started if you want to do this.
