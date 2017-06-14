const express = require('express');
const content = require('../content');
const fetch = require('node-fetch');

const router = express.Router();

const sendPurge = id => {
  return fetch("https://api.fastly.com/service/" + process.env.FASTLY_SERVICE_ID + "/purge/articles/" + id, {
    method: 'POST',
    headers: {
      'Fastly-Key': process.env.FASTLY_API_TOKEN,
      'Fastly-Soft-Purge': 1
    }
  })
    .then(resp => resp.json())
    .then(data => console.log('purged ' + id, data))
  ;
};

const indexHandler = (req, res) => {
  const locals = {};
  if (req.params.topic) {
    locals.topic = req.params.topic;
    locals.articles = content.getArticlesbyTopic(req.params.topic);
  } else {
    locals.articles = content.getArticles();
  }
  res.set('Surrogate-Key', locals.articles.map(a => 'articles/'+a.id).join(' '));
  if (req.app.locals.frag) res.set('Fragment', 1);
  res.render('news-index', locals );
};

const articleHandler = (req, res, next) => {
  const article = content.getArticle(req.params.id);
  if (!article) return next();
  res.set('Surrogate-Key', 'articles/'+article.id);
  if (req.app.locals.frag) res.set('Fragment', 1);
  res.render('article', {article});
};

const suspendHandler = (req, res) => {
  const article = content.getArticle(req.body.id);
  if (article) {
    content.suspendArticle(article.id);
    res.json(true);
  } else {
    res.json({status:'error', msg:'No such article found'});
  }
};

content.on('deletedArticle', sendPurge);

router.get('/', indexHandler);
router.get('/topics/:topic', indexHandler);
router.get('/articles/:id', articleHandler);
router.post('/suspend-article', suspendHandler);

module.exports = router;
