const distance = (lat1, lon1, lat2, lon2, unit) => {
  var radlat1 = Math.PI * lat1/180
  var radlat2 = Math.PI * lat2/180
  var theta = lon1-lon2
  var radtheta = Math.PI * theta/180
  var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
  dist = Math.acos(dist)
  dist = dist * 180/Math.PI
  dist = dist * 60 * 1.1515
  if (unit=="K") { dist = dist * 1.609344 }
  if (unit=="N") { dist = dist * 0.8684 }
  return dist
}

const period = sec => {
  const month = Math.round((365/12) * 24 * 60 * 60);
  const day = 24 * 60 * 60;
  const hour = 60 * 60;
  const minute = 60;
  return (sec > (3*month)) ? Math.round(sec/month) + ' months' :
    (sec > (2*day)) ? Math.round(sec/day) + ' days' :
    (sec > (2*hour)) ? Math.round(sec/hour) + ' hours' :
    (sec > (2*minute)) ? Math.round(sec/minute) + ' min' :
    sec + ' sec'
  ;
};


const getDatacenterMeta = code => Promise.resolve(
  localStorage.datacenters ? JSON.parse(localStorage.datacenters)[code] : (() => {
    return fetch("/datacenters")
      .then(resp => resp.json())
      .then(data => {
        localStorage.datacenters = JSON.stringify(data);
        return data[code];
      })
    ;
  })()
);

const getGeoIPMeta = ip => {
  const cache = localStorage.geoip ? JSON.parse(localStorage.geoip) : {};
  return Promise.resolve(cache[ip] || (() => {
    return fetch("https://freegeoip.net/json/"+ip, {mode:'cors'})
      .then(resp => resp.json())
      .then(data => {
        cache[ip] = data;
        localStorage.geoip = JSON.stringify(cache);
        return data;
      })
    ;
  })());
};

function getResponseMetadata() {
  return new Promise(resolve => {

    // If there is no SW controller, use timing data measured from the tab instead
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return resolve(performance.timing);

    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = event => {
      if (event.data.status === 'ok') {
        resolve(event.data.data);
      } else {
        throw new Error(event.data.message || "Failed to get perf data from Serviceworker");
      }
    };
    navigator.serviceWorker.controller.postMessage({name:"getRespMeta", data: {url: location.href}}, [messageChannel.port2]);
  });
}

if (!navigator.onLine || document.querySelector('.offline-notice')) {
    document.getElementById('netinfo').classList.add('netinfo--offline');
} else {

  const netInfo = {};

  getResponseMetadata()
    .then(data => {
      Object.assign(netInfo, data, {
        dnsTimeMS: Math.round(data.domainLookupEnd - data.domainLookupStart),
        tcpTimeMS: Math.round(data.connectEnd - data.connectStart),
        reqTimeMS: Math.round(data.responseStart - data.requestStart),
        resTimeMS: Math.round(data.responseEnd - data.responseStart),
        navigationStart: data.navigationStart || data.fetchStart
      });
      if (netInfo.transferSize === 0 && !("source" in netInfo)) {
        netInfo.source = 'httpCache';
      }
      netInfo.overheadMS = netInfo.responseEnd - netInfo.navigationStart - netInfo.dnsTimeMS - netInfo.tcpTimeMS - netInfo.reqTimeMS - netInfo.resTimeMS;
      netInfo.sendTimeMS = (netInfo.dnsTimeMS + netInfo.tcpTimeMS + netInfo.reqTimeMS) - (netInfo.edgeElapsedTimeMS || 0);
      if (netInfo.edgeCacheState) {
        netInfo.edgeCacheState = netInfo.edgeCacheState.toLowerCase();
        if (netInfo.edgeCacheState.startsWith('miss')) {
          netInfo.edgeObjectState = 'Not in cache (MISS)';
        } else if (netInfo.edgeCacheState.startsWith('pass') || netInfo.edgeCacheState.startsWith('hitpass')) {
          netInfo.edgeObjectState = 'Not eligible for caching (PASS)';
        } else if (netInfo.edgeCacheState.startsWith('hit-stale')) {
          if (netInfo.edgeObjRemainingSWR) {
            netInfo.edgeObjectState = 'Stale while revalidating (HIT)';
            netInfo.edgeObjectStateDesc = 'Revalidation time remaining: '+period(netInfo.edgeObjRemainingSWR);
          } else if (netInfo.edgeObjRemainingSIE) {
            netInfo.edgeObjectState = 'Stale due to origin failure (HIT)';
            netInfo.edgeObjectStateDesc = 'Using while origin down for up to another '+period(netInfo.edgeObjRemainingSIE);
          } else {
            netInfo.edgeObjectState = 'Stale HIT';
            netInfo.edgeObjectStateDesc = 'Unknown reason for stale hit';
          }
        } else if (netInfo.edgeCacheState.startsWith('hit')) {
          netInfo.edgeObjectState = 'Fresh in cache (HIT)';
          netInfo.edgeObjectStateDesc = netInfo.edgeObjCacheHitCount+' hits, remaining TTL '+period(netInfo.edgeObjRemainingTTL);
        } else {
          netInfo.edgeObjectState = netInfo.edgeCacheState;
        }
      } else {
        netInfo.edgeObjectState = "Unknown";
        netInfo.edgeObjectStateDesc = "No Fastly metadata";
      }
    })

    // Geolocate all the nodes
    .then(() => Promise.all(['backend', 'client', 'edge']
      .filter(nodeName => !(netInfo[nodeName+'Lat'] && netInfo[nodeName+'Lng'] && netInfo[nodeName+'City']))
      .map(nodeName => {
        if (netInfo[nodeName + 'Datacenter']) {
          return getDatacenterMeta(netInfo[nodeName + 'Datacenter'])
            .then(data => {
              netInfo[nodeName+'City'] = data.name;
              netInfo[nodeName+'Lat'] = data.coordinates.latitude;
              netInfo[nodeName+'Lng'] = data.coordinates.longitude;
            })
          ;
        } else if (netInfo[nodeName + 'IP']) {
          return getGeoIPMeta(netInfo[nodeName+'IP'])
            .then(data => {
              netInfo[nodeName+'City'] = data.city;
              netInfo[nodeName+'Lat'] = data.latitude;
              netInfo[nodeName+'Lng'] = data.longitude;
            })
          ;
        }
      })
    ))

    // Calculate derived data and populate page
    .then(() => {
      if (netInfo.source === 'swCache') {
        document.getElementById('netinfo').classList.add('netinfo--offline');
      } else {
        if ('clientLat' in netInfo && 'edgeLat' in netInfo) {
          netInfo.clientDistance = Math.round(distance(netInfo.clientLat, netInfo.clientLng, netInfo.edgeLat, netInfo.edgeLng, 'K'));
        }
        if ('backendLat' in netInfo && 'edgeLat' in netInfo) {
          netInfo.backendDistance = Math.round(distance(netInfo.backendLat, netInfo.backendLng, netInfo.edgeLat, netInfo.edgeLng, 'K'));
        }
        if ('clientCity' in netInfo) {
          netInfo['clientCity'] = netInfo['clientCity'].replace(/\b\w/g, l => l.toUpperCase());
        }
        const cacheClass = (!('edgeCacheState' in netInfo)) ? 'netinfo--nocache' : netInfo.edgeCacheState.startsWith('hit') ? 'netinfo--hit' : 'netinfo--miss';
        if (cacheClass === 'netinfo--hit') {

          // Remove the backend exec time if it's a hit
          netInfo.backendExecTimeMS = undefined;
          netInfo.edgeProcessingTimeMS = (netInfo.edgeElapsedTimeMS || 0);
        } else {
          netInfo.edgeProcessingTimeMS = (netInfo.edgeElapsedTimeMS || 0) - (netInfo.backendExecTimeMS || 0);
        }
        document.getElementById('netinfo').classList.add(cacheClass);
        document.getElementById('netinfo').querySelectorAll('[data-netinfo]').forEach(el => {
          if (netInfo[el.dataset.netinfo] === undefined || Number.isNaN(netInfo[el.dataset.netinfo])) {
            el.style.display = 'none';
          } else if (el.querySelector('i')) {
            el.querySelector('i').innerHTML = netInfo[el.dataset.netinfo];
          } else {
            el.innerHTML = netInfo[el.dataset.netinfo];
          }
        });

        const timingBar = {
          overhead: Math.max(netInfo.overheadMS, 0) || 0,
          conn: Math.max(netInfo.sendTimeMS, 0) || 0,
          fastly: Math.max(netInfo.edgeProcessingTimeMS, 0) || 0,
          beexec: Math.max(netInfo.backendExecTimeMS, 0) || 0,
          resp: Math.max(netInfo.resTimeMS, 0) || 0
        }
        const timingTotal = Object.keys(timingBar).reduce((out, k) => out + timingBar[k], 0);
        Object.keys(timingBar).forEach(k => {
          const el = document.getElementById('nettiming-'+k);
          el.style.width = ((timingBar[k]/timingTotal)*100)+'%';
          el.innerHTML = Math.round(timingBar[k])+'ms';
        });

        Tippy('.tip', {arrow: true});

        console.log(netInfo);
      }
    })
  ;
}
