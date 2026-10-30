import congestionEnum from '../consts/congestionEnum';

// Congestion score is a normalised number between 0 and 100
// 100: no congestion
// 0: full congestion (all roads severe)
export default function calculateCongestionScore(roads) {
  const denominator = roads.length * congestionEnum.low.value;
  const score = roads.reduce((sum, road) => sum + congestionEnum[road.properties.congestion].value, 0);
  return Math.round((score / denominator) * 100);
}
