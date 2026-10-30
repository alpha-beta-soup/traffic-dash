import congestionEnum from '../consts/congestionEnum';

export default function congestionConversion(score) {
  if (score < 25) return congestionEnum.severe;
  if (score < 50) return congestionEnum.heavy;
  if (score < 75) return congestionEnum.moderate;
  return congestionEnum.low;
}
