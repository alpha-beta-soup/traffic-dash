import _ from 'lodash'
import turf from 'turf-helpers'

const geojsonCameras = (cameras) => {
  return turf.featureCollection(_.map(cameras, camera => {
    return turf.point([camera.lon, camera.lat], _.omit(camera, ['lat', 'lon']))
  }))
}

if (module) {
  module.exports = geojsonCameras
}
