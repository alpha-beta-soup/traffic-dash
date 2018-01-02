import _ from 'lodash'
import turf from 'turf-helpers'

const geojsonSigns = (signs) => {
  return turf.featureCollection(_.map(signs, sign => {
    return turf.point([sign.lon, sign.lat], _.omit(sign, ['lat', 'lon']))
  }))
}

if (module) {
  module.exports = geojsonSigns
}
