'use strict';

require('dotenv').load();

const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const serveStatic = require('./lib/static-assets');
const hbs = require('./lib/view-engine')({helpers:{getVersionedPath: serveStatic.getVersionedPath}});

const PORT = process.env.PORT || 3100;

const app = express();

app.engine('.hbs', hbs.engine);
app.set('view engine', '.hbs');

// Serve static assets
app.use(serveStatic.middleware);

// Make template partials available to front end for use in ServiceWorker
app.use(hbs.exposeTemplates);

// Measure and report execution time using server-timing API
app.use(require('./lib/exec-time.js'));

// Parse request bodies
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Detect requests for fragments instead of full pages
app.use((req, res, next) => {
  app.locals.withHeader = app.locals.withFooter = !(req.headers['accept-fragment'] || req.query.frag !== undefined);
  app.locals.frag = !app.locals.withHeader;
  next();
});

// Add Vary header to ensure cache separation
app.use((req, res, next) => {
  res.set('Vary', 'Accept-Fragment');
  next();
});

// Allow caching at the edge, but not in the browser (to allow purging)
app.use(function(req, res, next) {
  res.set('Cache-Control', 'max-age=0; s-maxage=31536000; append-metadata');
  next();
});

// Process requests
app.use(require('./routes/main'));
app.use(require('./routes/shell'));

// Return a 404 if no routes match
app.use((req, res, next) => {
  if (req.app.locals.frag) res.set('Fragment', 1);
  res.status(404).render("not-found");
});

app.listen(PORT, () => {
  console.log('Listening on port ' + PORT);
});
