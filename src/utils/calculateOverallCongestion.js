const calculateCongestionScore = require('./calculateCongestionScore')
const congestionConversion = require('./congestionConversion')

function calculateOverallCongestion(roads) {
  if (roads === undefined || roads === null || !roads.length) {
    return null;
  }
  const score = calculateCongestionScore(roads);
  let congestion = congestionConversion(score);
  congestion.score = score;
  return congestion
}

if (module) {
  module.exports = calculateOverallCongestion
}
