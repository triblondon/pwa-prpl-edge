const express = require('express');
const fetch = require('node-fetch');
const content = require('../content');

const staticFiles = [
  '/shell/offline',
  '/shell/fragments/header',
  '/shell/fragments/footer',
  'https://fonts.googleapis.com/css?family=Raleway:300,400,500,600,700',
  '/css/styles.css',
  '/css/ux-platform.css',
  '/js/net-info.js',
  '/js/purge.js',
  '/js/analytics.js',
  '/js/sw-connect.js',
  '/images/icons/16x16.png',
  '/images/icons/32x32.png',
  '/images/icons/laptop.svg',
  '/images/icons/fastly.svg',
  '/images/icons/server.svg',
  '/images/icons/offline.svg',
  '/images/fastly-logo.svg',
  '/images/guardian-logo.svg',
  '/manifest.json'
];


const router = express.Router();

router.get('/shell/fragments/header', (req, res) => {
	res.render('blank', {withHeader: true, withFooter: false});
});
router.get('/shell/fragments/footer', (req, res) => {
	res.render('blank', {withHeader: false, withFooter: true});
});

router.get('/shell/files/static', (req, res) => {
	res.json(staticFiles);
});
router.get('/shell/files/dynamic', (req, res, next) => {
  res.set('Surrogate-Key', 'indexes');
  res.json([].concat(
    content.getArticleIDs().map(id => "/articles/"+id+"?frag=1"),
    content.getTopics().map(topic => "/topics/"+topic+"?frag=1")
  ));
});

router.get('/shell/offline', (req, res) => {
  if (req.app.locals.frag) res.set('Fragment', 1);
	res.render('offline');
});
router.get('/shell/not-found', (req, res) => {
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
