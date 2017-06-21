
if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {

    // Break SW path into two strings to avoid replacing it with a ref to the staticified version
    // It's important that serviceworker retains the same URL when it changes because the browser
    // will check this URL for updates.  It's also important that the script sits at the top
    // level of the domain, because otherwise it's scope will be limited.
    navigator.serviceWorker.register('/s'+'w.js').catch(err => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}
