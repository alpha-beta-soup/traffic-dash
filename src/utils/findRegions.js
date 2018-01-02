const findRegions = (cameras) => {
  return [...new Set(cameras.map(camera => camera.region))];
}

if (module) {
  module.exports = findRegions
}
