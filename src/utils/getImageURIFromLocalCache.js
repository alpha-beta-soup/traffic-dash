const localCache = require('../consts/localCache')

function getImageFromLocalCache(cameraId, fileName) {
  return encodeURI(`${localCache}/${cameraId}/${fileName}`)
}

if (module) {
  module.exports = getImageFromLocalCache
}
