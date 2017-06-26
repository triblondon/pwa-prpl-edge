const express = require('express');
const content = require('../content');
const fetch = require('node-fetch');
const SSEChannel = require('../lib/sse');

const router = express.Router();
const fastlyApiHeaders = {
  'Fastly-Key': process.env.FASTLY_API_TOKEN,
  'Fastly-Soft-Purge': 1
};
const MAX_PURGE_COUNT = 10;

const sse = SSEChannel();

const changeSetToSKeys = changeSet => {
  let keys = [];
  if (changeSet.topicsAffected.size > MAX_PURGE_COUNT) {
    keys = keys.concat(['topics']);
  } else {
    keys = keys.concat(Array.from(changeSet.topicsAffected).map(tid => 'topics/'+tid));
  }
  if (changeSet.articlesAffected.size > MAX_PURGE_COUNT) {
    keys = keys.concat(['articles']);
  } else {
    keys = keys.concat(Array.from(changeSet.articlesAffected).map(aid => 'articles/'+aid));
  }
  if (keys.length) {
    keys.push('top', 'indexes');
  }
  return keys;
}

const sendPurges = skeys => {
  const url = "https://api.fastly.com/service/" + process.env.FASTLY_SERVICE_ID + "/purge";
  const fetchOpts = { method: 'POST', headers: fastlyApiHeaders };
  console.log("Purging", skeys);
  return Promise.all(skeys.map(skey => fetch(url + "/" + skey, fetchOpts).then(resp => resp.json()))).then(() => true);
};

const indexHandler = (req, res) => {
  const locals = {};
  const skeys = ['all'];
  if (req.params.topic) {
    skeys.push('topics');
    skeys.push('topics/'+req.params.topic);
    locals.topic = req.params.topic;
    locals.articles = content.getArticlesbyTopic(req.params.topic);
  } else {
    skeys.push('top');
    locals.articles = content.getArticles();
  }
  skeys.push(locals.articles.map(a => 'articles/'+a.id));
  res.set('Surrogate-Key', skeys.join(' '));
  if (req.app.locals.frag) res.set('Fragment', 1);
  res.render('news-index', locals );
};

const articleHandler = (req, res, next) => {
  const article = content.getArticle(req.params.id);
  if (!article) return next();
  res.set('Surrogate-Key', 'all articles articles/'+article.id);
  if (req.app.locals.frag) res.set('Fragment', 1);
  res.render('article', {article});
};

const refreshHandler = (req, res) => {
  content.fetchNewContent().then(changeSet => {
    res.set("Cache-Control", "private, no-store");
    res.json({topicCount: changeSet.topicsAffected.size, articleCount: changeSet.articlesAffected.size});
  }).catch(e => res.json(e));
};

const streamHandler = (req, res) => sse.subscribe(req, res);

content.on('contentChange', changeSet => {
  const keysChanged = changeSetToSKeys(changeSet);
  sse.publish({event:'update', keysChanged:keysChanged, time:Date.now()}, 'contentChange');
});

// Enable purging if connected to a Fastly service
if (process.env.FASTLY_SERVICE_ID) {
  content.on('contentChange', changeSet => sendPurges(changeSetToSKeys(changeSet)));
  sendPurges(['shell']);
}

router.get('/', indexHandler);
router.get('/topics/:topic', indexHandler);
router.get('/articles/:id', articleHandler);
router.get('/refresh-content', refreshHandler);
router.get('/event-stream', streamHandler);
router.get('/health', (req, res) => {
  res.set('Cache-Control', 'max-age=0; private');
  res.end('OK');
});

module.exports = router;
