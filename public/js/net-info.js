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


const getServerTimingData = () => {
  return performance
    .getEntriesByName(location.href)
    .filter(ent => ent.entryType === 'server')
    .reduce((out, rec) => {
      out[rec.metric] = rec.duration;  // Assuming that all metrics are durations (spec allows for description only)
      return out;
    }, {})
  ;
};

const getEdgeTimingData = () => {
  const readCookie = (k,r) => (r=RegExp('(^|; )'+encodeURIComponent(k)+'=([^;]*)').exec(document.cookie)) ? r[2] : null;
  const cookieStr = readCookie('CacheStats');
  if (cookieStr) {
    return JSON.parse(cookieStr);
  } else if (['127.0.0.1', 'localhost'].includes(location.hostname)) {
    return {"source": "test", "edgeID":"cache-sjc3132-SJC","edgeDatacenter":"SJC","edgeIP":"151.101.41.209","edgeCacheState":"HIT","edgeObjectHash":"0.902","edgeVCLVer":"39MzaFBISKerFJYsFCqa4U.28_9-098a41bd2a0bade8b9b0217f0b3a8336","edgeElapsedTimeMS":30,"edgeCacheHitCount":1,"edgeTTL":3600,"edgeObjectAge":4001,"edgeSWR":300,"edgeSIE":86400,"clientIP":"8.18.217.202","clientLat":37.786,"clientLng":-122.436,"clientCity":"san francisco","clientBrowserName":"Chrome","clientBrowserVer":"","clientIsMobile":"0","backendID":"shield__cache_sjc3132_SJC__sjc_ca_us","backendIP":"216.58.192.20","backendName":"39MzaFBISKerFJYsFCqa4U--F_Google_App_Engine","x":true};
  } else {
    return {};
  }
}


if (!navigator.onLine || document.querySelector('.offline-notice')) {
    document.getElementById('netinfo').classList.add('netinfo--offline');
} else {

  const netInfo = {};

  // Aggregate all the timing data from navigationTiming, serverTiming, and cookie from Fastly
  Promise.all([getEdgeTimingData(), getNavigationTimingData(), getServerTimingData()])
    .then(([edgeData, connData, serverData]) => {
      Object.assign(netInfo, edgeData, serverData);
      if (connData) {
        Object.assign(netInfo, {
          dnsTimeMS: Math.round(connData.domainLookupEnd - connData.domainLookupStart),
          tcpTimeMS: Math.round(connData.connectEnd - connData.connectStart),
          reqTimeMS: Math.round(connData.responseStart - connData.requestStart),
          resTimeMS: Math.round(connData.responseEnd - connData.responseStart),
          navigationStart: connData.navigationStart || connData.fetchStart,
          responseEnd: connData.responseEnd,
          transferSize: connData.transferSize,
          encodedBodySize: connData.encodedBodySize,
          decodedBodySize: connData.decodedBodySize
        });
        if (netInfo.transferSize === 0) {
          netInfo.source = 'httpCache';
        }
        netInfo.overheadMS = netInfo.responseEnd - netInfo.navigationStart - netInfo.dnsTimeMS - netInfo.tcpTimeMS - netInfo.reqTimeMS - netInfo.resTimeMS;
        netInfo.sendTimeMS = (netInfo.dnsTimeMS + netInfo.tcpTimeMS + netInfo.reqTimeMS) - netInfo.edgeElapsedTimeMS;
        if (netInfo.edgeCacheState) {
          if (netInfo.edgeCacheState.toLowerCase().startsWith('miss')) {
            netInfo.edgeObjectState = 'Not in cache (MISS)';
          } else if (netInfo.edgeCacheState.toLowerCase().startsWith('pass')) {
            netInfo.edgeObjectState = 'Not eligible for caching (PASS)';
          } else if (netInfo.edgeCacheState.toLowerCase().startsWith('hit')) {
            if (netInfo.edgeObjectAge < netInfo.edgeTTL) {
              netInfo.edgeObjectState = 'Fresh in cache (HIT)';
              netInfo.edgeObjectStateDesc = netInfo.edgeCacheHitCount+' hits, remaining TTL '+(netInfo.edgeTTL-netInfo.edgeObjectAge)+'s';
            } else if (netInfo.edgeObjectAge < (netInfo.edgeTTL + netInfo.edgeSWR)) {
              netInfo.edgeObjectState = 'Stale while revalidating (HIT)';
              netInfo.edgeObjectStateDesc = 'Revalidation time remaining: '+((netInfo.edgeTTL + netInfo.edgeSWR)-netInfo.edgeObjectAge)+'s';
            } else if (netInfo.edgeObjectAge < (netInfo.edgeTTL + netInfo.edgeSIE)) {
              netInfo.edgeObjectState = 'Stale due to origin failure (HIT)';
              netInfo.edgeObjectStateDesc = 'Using while origin down for up to another '+((netInfo.edgeTTL + netInfo.edgeSIE)-netInfo.edgeObjectAge)+'s';
            } else {
              netInfo.edgeObjectState = 'Stale HIT';
              netInfo.edgeObjectStateDesc = 'Unknown reason for cache hit';
            }
          } else {
            netInfo.edgeObjectState = netInfo.edgeCacheState;
          }
        } else {
          netInfo.edgeObjectState = "Unknown";
          netInfo.edgeObjectStateDesc = "No Fastly metadata";
        }
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
        const cacheClass = ('edgeCacheState' in netInfo && netInfo.edgeCacheState.startsWith('HIT')) ? 'netinfo--hit' : 'netinfo--miss';
        if (cacheClass === 'netinfo--hit') {
          netInfo.edgeProcessingTimeMS = (netInfo.edgeElapsedTimeMS || 0);
        } else {
          netInfo.edgeProcessingTimeMS = (netInfo.edgeElapsedTimeMS || 0) - (netInfo.backendExecTimeMS || 0);
        }
        document.getElementById('netinfo').classList.add(cacheClass);
        document.getElementById('netinfo').querySelectorAll('[data-netinfo]').forEach(el => {
          el.innerHTML = netInfo[el.dataset.netinfo];
        });

        const timingBar = {
          overhead: Math.max(netInfo.overheadMS, 0),
          conn: Math.max(netInfo.sendTimeMS, 0),
          fastly: Math.max(netInfo.edgeProcessingTimeMS, 0),
          beexec: Math.max(netInfo.backendExecTimeMS, 0),
          resp: Math.max(netInfo.resTimeMS, 0)
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
