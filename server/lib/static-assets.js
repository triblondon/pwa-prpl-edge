const path = require('path');
const fs = require('fs');
const mime = require('mime');
const copyDir = require('copy-dir').sync;
const deleteDir = require('rimraf').sync;
const Staticify = require('staticify');

const SOURCE_DIR = path.join(__dirname, '../../public');
const BUILD_DIR = path.join(__dirname, '../../__build/public');
const TEXT_TYPES = ['image/svg+xml', 'application/json', 'application/javascript', 'text/css', 'text/html', 'text/plain'];

deleteDir(BUILD_DIR);
copyDir(SOURCE_DIR, BUILD_DIR);

const inst = Staticify(BUILD_DIR);

Object.keys(inst._versions).forEach(filePath => {
  const absPath = path.join(BUILD_DIR, filePath);
  const mimeType = mime.lookup(absPath);
  if (TEXT_TYPES.includes(mimeType)) {
    fs.writeFileSync(absPath, inst.replacePaths(fs.readFileSync(absPath, 'UTF-8')));
  }
});

module.exports = inst;
