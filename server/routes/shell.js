const express = require('express');
const hbs = require('../lib/view-engine');
const fetch = require('node-fetch');

const router = express.Router();

router.get('/shell', hbs.exposeTemplates, (req, res) => {
  res.set('Content-Type', 'application/javascript');
	res.render('shell', {layout:false});
});

router.get('/offline', (req, res) => {
  if (req.app.locals.frag) res.set('Fragment', 1);
	res.render('offline');
});
router.get('/not-found', (req, res) => {
  if (req.app.locals.frag) res.set('Fragment', 1);
	res.render('not-found');
});

router.get('/datacenters', (req, res) => {
  fetch("https://api.fastly.com/datacenters", {headers: { "Fastly-Key": process.env.FASTLY_API_TOKEN }})
    .then(resp => resp.json())
    .then(jsonData => {
      res.send(jsonData.reduce((out, item) => {
        out[item.code] = item;
        return out;
      }, {}));
    })
  ;
});

module.exports = router;
