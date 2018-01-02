const trafficEnum = require('../consts/trafficEnum')
const congestionEnum = require('../consts/congestionEnum')

const _roadClassCompare = (a, b) => {
  // Prefer more important road
  if (trafficEnum[a.properties.class].value < trafficEnum[b.properties.class].value) {
    return -1
  } else if (trafficEnum[a.properties.class].value > trafficEnum[b.properties.class].value) {
    return 1
  } else {
    // Prefer road with worse congestion
    if (congestionEnum[a.properties.congestion].value < congestionEnum[b.properties.congestion].value) {
      return -1
    } else if (congestionEnum[a.properties.congestion].value > congestionEnum[b.properties.congestion].value) {
      return 1
    } else {
      // Prefer nearer road
      if (a.properties.tilequery.distance < b.properties.tilequery.distance) {
        return -1
      } else if (a.properties.tilequery.distance > b.properties.tilequery.distance) {
        return 1
      }
    }
  }
  return 0
}

function sortAndFilterRoads(roads) {
  if (!roads || !roads.features.length) {
    return null
  }
  roads.features.sort(_roadClassCompare)
  roads.features = roads.features.filter(road => {
    // Filter roads that are more than one class less important than the most important road in the set
    // Assumption: e.g. that a camera on a motorway only cares about: motorway, motorway_link, and trunk
    return trafficEnum[road.properties.class].value <= (trafficEnum[roads.features[0].properties.class].value + 0.5)
  })
  return roads.features
}

if (module) {
  module.exports = sortAndFilterRoads
}
