import { useEffect, useState } from 'react';

import { fetchJson } from '../utils';

// Current weather at a point (OpenWeatherMap, through the server), fetched once; null until
// it arrives, or if weather isn't configured
export default function useWeather(enabled, lat, lon) {
  const [weather, setWeather] = useState(null);
  useEffect(() => {
    if (!enabled) return;
    fetchJson(`/api/weather?lat=${lat}&lon=${lon}`).then(setWeather).catch(console.error);
  }, [enabled, lat, lon]);
  return weather;
}
