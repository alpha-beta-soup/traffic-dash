const path = require('path')
const fs = require('fs')
const mkdirp = require('mkdirp')

module.exports = (filepath, buffer) => {
  return new Promise((resolve, reject) => {
    fs.exists(path.dirname(filepath), (exists) => {
      if (!exists) {
        mkdirp(path.dirname(filepath));
      }
      fs.writeFile(filepath, buffer, 'binary', (err) => {
        if (err) {
          console.error(err)
          reject(err)
        }
        resolve(`${process.env.LOCAL_CACHE_SERVER}/${filepath.split('/cache/')[1]}`)
      })
    })
  })
}
