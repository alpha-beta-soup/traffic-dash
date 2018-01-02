const getCameraAngle = (direction) => {
  let angle = null;
  switch (true) {
    case (direction === "Northbound"):
      angle = 270;
      break;
    case (direction === "Eastbound"):
      angle = 0;
      break;
    case (direction === "Southbound"):
      angle = 90;
      break;
    case (direction === "Westbound"):
      angle = 180;
      break;
    default:
      angle = 0;
  }
  return angle;
}

if (module) {
  module.exports = getCameraAngle
}
