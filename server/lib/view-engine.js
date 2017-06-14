const exphbs  = require('express-handlebars');

module.exports = options => {

  // Initialise Handlebars / Express integration
  var hbs = exphbs.create(Object.assign({
    defaultLayout: 'main', // By default, render complete HTML pages
    extname: '.hbs'
  }, options));

  return {
	  engine: hbs.engine,
  }
};
