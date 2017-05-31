(function () {
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('[data-purge]').forEach(el => {
        el.addEventListener('click', function(event) {
          el.classList.add('in-progress');
          fetch('/suspend-article', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({id: el.dataset.purge})
          })
            .then(resp => resp.json())
            .then(data => {
              console.log("Purge respponse",data);
              alert('Article suspended for 20 mins.  All index pages referencing this article have been purged.');
              location.href = '/';
            })
          ;
        });
      });
    })
})();
