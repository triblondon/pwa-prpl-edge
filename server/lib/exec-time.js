const onHeaders = require('on-headers');

module.exports = function responseTime (req, res, next) {

  const startAt = process.hrtime();

  onHeaders(res, () => {
    const diff = process.hrtime(startAt);
    const timeMS = Math.round(diff[0] * 1e3 + diff[1] * 1e-6);
    res.setHeader('Server-Timing', 'backendExecTimeMS='+timeMS);
  });

  next()
}
