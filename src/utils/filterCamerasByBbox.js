const _ = require('lodash')

const filteredCameras = (cameras, bounds) => {
  return _.filter(cameras, (camera) => {
    const within = (camera.lon >= bounds._sw.lng
      && camera.lon <= bounds._ne.lng
      && camera.lat >= bounds._sw.lat
      && camera.lat <= bounds._ne.lat)
    return within
  })
}

if (module) {
  module.exports = filteredCameras
}
