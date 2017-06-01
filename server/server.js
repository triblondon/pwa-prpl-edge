'use strict';

require('dotenv').load();

const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const gcm = require('node-gcm');
const hbs = require('./lib/view-engine');


const PORT = process.env.PORT || 3100;

const app = express();

app.engine('.hbs', hbs.engine);
app.set('view engine', '.hbs');

app.use(require('./lib/exec-time.js'));


// Parse request bodies to enable web push
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Detect requests for fragments instead of full pages
app.use((req, res, next) => {
  app.locals.frag = (req.headers['accept-fragment'] || req.query.frag !== undefined);
  next();
});

// Add Vary header to ensure cache separation
app.use((req, res, next) => {
  res.set('Vary', 'Accept-Fragment');
  next();
});

// Serve static assers from /static (TODO: version stamp these and allow them to be cached)
app.use(function(req, res, next) {
  res.set('Cache-Control', 'no-cache');
  next();
});
app.use(express.static(path.join(__dirname, '../public')));

// For non-static assets, allow caching at the edge but not in the browser
app.use(function(req, res, next) {
  res.set('Cache-Control', 'max-age=31536000; append-metadata');
  next();
});

app.use(require('./routes/main'));
app.use(require('./routes/shell'));

app.use((req, res, next) => {
  if (req.app.locals.frag) res.set('Fragment', 1);
  res.status(404).render("not-found");
});

app.listen(PORT, () => {
  console.log('Listening on port ' + PORT);
});
