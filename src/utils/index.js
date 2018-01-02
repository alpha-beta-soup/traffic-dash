import getS3ImageURL from './getS3ImageURL'
import aws from './awsInit'
import saveJpegBufferLocally from './saveJpegBufferLocally'
import replaceAll from './replaceAll'
import listFilesInDir from './listFilesInDir'
import listS3BucketImages from './listS3BucketImages'
import uploadJpegBufferToS3 from './uploadJpegBufferToS3'
import getImageURIFromLocalCache from './getImageURIFromLocalCache'
import calculateCongestionScore from './calculateCongestionScore'
import sortAndFilterRoads from './sortAndFilterRoads'
import congestionConversion from './congestionConversion'
import calculateOverallCongestion from './calculateOverallCongestion'
import getCameraAngle from './getCameraAngle'
import parseCameras from './parseCameras'
import parseSigns from './parseSigns'
import findRegions from './findRegions'
import geojsonCameras from './geojsonCameras'
import geojsonSigns from './geojsonSigns'
import encodeS3URI from './encodeS3URI'
import filterCamerasByBbox from './filterCamerasByBbox'
import getRandomInt from './getRandomInt'
import getWeatherIcon from './weatherIcon'

module.exports = {
  saveJpegBufferLocally,
  aws,
  getS3ImageURL,
  replaceAll,
  listImagesInImageCacheDir: listFilesInDir,
  listImagesInS3: listS3BucketImages,
  uploadJpegBufferToS3,
  getImageFromLocalCache: getImageURIFromLocalCache,
  calculateCongestionScore,
  congestionConversion,
  calculateOverallCongestion,
  sortAndFilterRoads,
  getCameraAngle,
  parseCameras,
  parseSigns,
  findRegions,
  parseGeojsonCameras: geojsonCameras,
  parseGeojsonSigns: geojsonSigns,
  encodeS3URI,
  filterCamerasByBoundingBox: filterCamerasByBbox,
  getRandomInt,
  getWeatherIcon
}
