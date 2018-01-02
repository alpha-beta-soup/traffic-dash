const fs = require('fs')
const async = require('async')
const moment = require('moment-timezone')

const localCache = require('../consts/localCache')

// TODO avoid the double statSync

function compareCTime(file1, file2) {
  const files = [file1, file2].map((f) => {
    return [localCache, f].join('/')
  }).map((f) => {
    return fs.statSync(f)
  })
  return files[0].mtime - files[1].mtime
}

function listImagesInImageCacheDir(id, noOlder) {
  const dir = [localCache, id].join('/')
  return new Promise((resolve, reject) => {
    fs.readdir(dir, (err, items) => {
      if (err) {
        console.error(err)
        reject(err)
      }
      resolve(items.map(img => {
        return {img, stats: fs.statSync([localCache, id, img].join('/'))}
      }).filter(({img, stats}) => {
        if (!noOlder) return true
        return moment().diff(moment(stats.mtime)) < noOlder
      }).map(({img, stats}) => {
        return [id, img].join('/')
      }).sort(compareCTime))
    })
  })
}

if (module) {
  module.exports = listImagesInImageCacheDir
}
