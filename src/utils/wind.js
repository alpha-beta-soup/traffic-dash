import { compassPoint } from './nearestCameras';

export const WINDY = 20; // km/h: wind worth mentioning where space is short (the cards)
// Strong enough to trouble high-sided vehicles and blow debris onto roads
export const STRONG_WIND = 50; // km/h, sustained
export const STRONG_GUST = 70; // km/h

// OpenWeatherMap's wind ({ speed, gust } in m/s with metric units; deg: the direction it blows
// from) for display: { speed, gust (km/h; gust null unless above the speed), from: compass point
// it blows from, towards: degrees it blows towards, windy, strong }, or null if there's none
export default function describeWind(wind) {
  if (wind?.speed == null) return null;
  const speed = wind.speed * 3.6;
  const gust = wind.gust > wind.speed ? wind.gust * 3.6 : null;
  const hasDirection = typeof wind.deg === 'number';
  return {
    speed: Math.round(speed),
    gust: gust && Math.round(gust),
    from: hasDirection ? compassPoint(wind.deg) : null,
    towards: hasDirection ? (Math.round(wind.deg) + 180) % 360 : null,
    windy: speed > WINDY || gust >= STRONG_GUST,
    strong: speed >= STRONG_WIND || gust >= STRONG_GUST,
  };
}
