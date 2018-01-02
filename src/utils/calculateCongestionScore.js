const CongestionEnum  = require('../consts/congestionEnum')

function calculateCongestionScore(roads) {
  // Congestion score is a normalised number between 0 and 100
  // 100: no congestion
  // 0: full congestion (all roads severe)
  let score = 0;
  let denominator = roads.length * CongestionEnum['low'].value;
  roads.forEach(road => {
    score += CongestionEnum[road.properties.congestion].value;
  })
  return Math.round(score/denominator*100);
}

if (module) {
  module.exports = calculateCongestionScore
}
