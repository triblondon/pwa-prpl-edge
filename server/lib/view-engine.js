const exphbs  = require('express-handlebars');

module.exports = options => {

  // Initialise Handlebars / Express integration
  var hbs = exphbs.create(Object.assign({
    defaultLayout: 'main', // By default, render complete HTML pages
    extname: '.hbs'
  }, options));

  // Middleware to expose the app's templates to the client-side of the app
  function exposeTemplates(req, res, next) {

      // Uses the `ExpressHandlebars` instance to get the get the **precompiled**
      // templates which will be shared with the client-side of the app.
      hbs.getTemplates('views/partials/', {
          cache: req.app.enabled('view cache'),
          precompiled: true
      }).then(templates => {
          console.log('generating templates', templates);

          // RegExp to remove the file extension from the template names.
          var extRegex = new RegExp(hbs.extname + '$');

          // Creates an array of templates which are exposed via
          // `res.locals.templates`.
          templates = Object.keys(templates).map(function (name) {
              return {
                  name    : name.replace(extRegex, ''),
                  template: templates[name].replace(/(<\/?scr)(ipt)/g, '$1"+"$2')
              };
          });

          // Exposes the templates during view rendering.
          if (templates.length) {
              res.locals.templates = templates;
          }

          setImmediate(next);
      })
      .catch(next);
  }
  return {
	  engine: hbs.engine,
	  exposeTemplates: exposeTemplates
  }
};
