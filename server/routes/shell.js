const express = require('express');
const fetch = require('node-fetch');
const content = require('../content');

const router = express.Router();

router.get('/shell/fragments/header', (req, res) => {
	res.render('blank', {withHeader: true, withFooter: false});
});
router.get('/shell/fragments/footer', (req, res) => {
	res.render('blank', {withHeader: false, withFooter: true});
});

router.get('/shell/files/dynamic', (req, res, next) => {
  res.set('Surrogate-Key', 'indexes');
  res.json([].concat(
    content.getArticleIDs().map(id => "/articles/"+id+"?frag=1"),
    content.getTopics().map(topic => "/topics/"+topic+"?frag=1"),
    ['/?frag=1']
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
  if (!process.env.FASTLY_API_TOKEN) {
    res.json({});
    return;
  }
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
