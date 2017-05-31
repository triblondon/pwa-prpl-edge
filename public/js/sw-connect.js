function getNavigationTimingData() {
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
    navigator.serviceWorker.controller.postMessage({name:"getPerfEntries", data: {url: location.href}}, [messageChannel.port2]);
  });
}

if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);

      // Fires on install and when serviceWorker file changes
      registration.addEventListener("updatefound", () => {

        // To check if service worker is already installed and controlling the page or not
        if (navigator.serviceWorker.controller) {
          const installingSW = registration.installing;
          installingSW.onstatechange = function() {
            console.info("Service Worker State :", installingSW.state);
            switch(installingSW.state) {
              case 'installed':
                // Now new contents will be added to cache and old contents will be remove so
                // this is perfect time to refresh the page
                location.reload();
                break;
              case 'redundant':
                console.log('The installing service worker became redundant.');
            }
          }
        }
      });

    }, err => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}
