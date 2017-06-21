window.addEventListener('load', () => {

  function initStreamingUpdates() {
    var key = location.pathname.replace(/\/$/, '');
    var es = new EventSource("/event-stream/"+(key || 'top'));
    es.addEventListener('contentChange', ev => {
      console.log(ev.data);
    });
  }

  // Connect to update stream if the page has been around for a while
  if (navigator.onLine) {
    setTimeout(initStreamingUpdates, 3000);
  }

});
