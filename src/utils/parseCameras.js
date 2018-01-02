const _ = require('lodash')
const getCameraAngle = require('./getCameraAngle')

const parseCameras = (cameras) => {
  const parse_props = ['offline', 'underMaintenance', 'lat', 'lon']
  const transformers = {}
  cameras.forEach(camera => {

    Object.keys(camera).forEach(key => {
      let stripped_key = key.replace(new RegExp("^tns:"), '')
      camera[stripped_key] = camera[key][0]
      if (_.includes(parse_props, stripped_key)) {
        camera[stripped_key] = JSON.parse(camera[key][0])
      }
      if (_.includes(Object.keys(transformers), stripped_key)) {
        camea[stripped_key] = transformers[stripped_key](camera[stripped_key])
      }
      delete camera[key]
      camera.direction_degrees = getCameraAngle(camera.direction)
    })
  })
  return cameras
}

if (module) {
  module.exports = parseCameras
}
