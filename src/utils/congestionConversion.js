const congestionEnum = require('../consts/congestionEnum')

function congestionConversion(score) {
  let congestion;
  switch (true) {
    case (score < 25):
      congestion = congestionEnum['severe'];
      break;
    case (score < 50):
      congestion = congestionEnum['heavy'];
      break;
    case (score < 75):
      congestion = congestionEnum['moderate'];
      break;
    default:
      congestion = congestionEnum['low'];
      break;
  }
  return congestion;
}

if (module) {
  module.exports = congestionConversion
}
