const congestionEnum = require('./congestionEnum')
const localCache = require('./localCache')
const trafficEnum = require('./trafficEnum')
const descriptionReplace = require('./descriptionReplace')

module.exports = {
  congestionEnum,
  localCache,
  trafficEnum,
  USE_LOCAL_CACHE: true,
  // TODO cache expiry
  LOADING: 'https://cdn.dribbble.com/users/1249/screenshots/796577/hatchbck_loading.png',
  ANIMATION_FRAME: 300,
  BLACK: '#113654',
  LIGHTBLACK: '#485d6f',
  descriptionReplace,
  CAMERA_RADIUS: 1000, // metres
  CAMERA_LIMIT: 20, // Maximum number of cameras to return
}
