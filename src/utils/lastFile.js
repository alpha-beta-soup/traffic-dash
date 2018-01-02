const fs = require('fs')
const _ = require('lodash')

module.exports = dir => {
  const files = fs.readdirSync(dir);
  return _.max(files, (f) => {
    return fs.statSync(f).mtime;
  });
}
