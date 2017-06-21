const crypto = require('crypto');
const fetch = require('node-fetch');
const FeedParser = require('feedparser');
const events = require('events');

const REFRESH_INTERVAL = 60000;
const SOURCE_URL = 'https://www.theguardian.com/uk/rss';
const RSS_FIELDS = ['id', 'title', 'description', 'summary', 'date', 'link', 'categories', 'enclosures'];
const SUSPEND_TIME_MS = 20 * 60 * 1000;

let articles = [];
let meta = {};
let suspended = {};
const eventEmitter = new events.EventEmitter();

const sha256 = inp => crypto.createHash('sha1').update(JSON.stringify(inp)).digest('hex');
const slugify = inp => inp.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, '-');

function refreshArticles(incremental) {
  console.log('Refreshing...');
  return fetch(SOURCE_URL)
    .then(resp => {
      const newarticles = [];
      const feedparser = new FeedParser();
      resp.body.pipe(feedparser);
      return new Promise(resolve => {
        feedparser.on('readable', function () {
          const stream = this;
          meta = this.meta;
          let item;
          while (item = stream.read()) {
            item.id = sha256(item.link);
            item.categories = item.categories.map(c => ({slug: slugify(c), label: c}) );
            newarticles.push(Object.keys(item).reduce((out, k) => {
              if (RSS_FIELDS.includes(k)) out[k] = item[k];
              return out;
            }, {}));
          }
        });
        feedparser.on('end', () => resolve(newarticles));
      });
    })
    .then(newarticles => {
      const updatedTopics = new Set();
      const updatedArticles = new Set();
      if (incremental) {
        const newArticle = newarticles.find(a1 => !articles.find(a2 => a2.id===a1.id));
        if (newArticle) {
          updatedArticles.add(newArticle.id);
          newArticle.categories.forEach(c => updatedTopics.add(c.slug));
          articles.unshift(newArticle);
        }
      } else {
        [].concat(
          newarticles.filter(a1 => !articles.find(a2 => a2.id===a1.id)),
          articles.filter(a1 => !newarticles.find(a2 => a2.id===a1.id))
        ).forEach(a => {
          updatedArticles.add(a.id);
          a.categories.forEach(c => updatedTopics.add(c.slug));
        });
        articles = newarticles;
      }

      // Announce content changes
      const changeData = {
        articlesAffected: updatedArticles,
        topicsAffected: updatedTopics
      };
      if (updatedArticles.size || updatedTopics.size) {
        eventEmitter.emit('contentChange', changeData);
      }
      return changeData;
    })
  ;
}
refreshArticles();

module.exports = {
  getArticleIDs: () => articles.map(a => a.id),
  getTopics: () => Array.from(articles.reduce((tset, a) => {
    (a.categories || []).forEach(t => tset.add(t.slug));
    return tset;
  }, new Set())),
  getArticlesbyTopic: topicid => articles.filter(article => article.categories.find(cat => cat.slug === topicid)).slice(0,10),
  getArticles: () => articles.slice(0,10),
  getArticle: id => articles.find(article => article.id === id),
  getMeta: () => meta,
  fetchNewContent: () => refreshArticles(true),
  on: eventEmitter.on.bind(eventEmitter)
};
