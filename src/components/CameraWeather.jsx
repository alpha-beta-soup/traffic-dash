import Typography from '@mui/material/Typography';

import { getWeatherIcon } from '../utils';
import { LIGHTBLACK } from '../consts';

const WIND_THRESHOLD = 20; // km/h
const COLD_TEMP = 3;
const HOT_TEMP = 30;

// Converts meteorological direction ("direction from") to a symbol rotation,
// assuming the symbol points "up" or "to the north" at 0 degrees (no rotation)
const meteo2rotation = d => (Math.round(d) + 180) % 360;

const timeFormat = new Intl.DateTimeFormat('en-NZ', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Pacific/Auckland',
});

export default function CameraWeather({ data: wx }) {
  if (!wx) return null;
  const now = Date.now() / 1000;
  const nightTime = now < wx.sys.sunrise || now > wx.sys.sunset;
  const sunChange = nightTime ? wx.sys.sunrise : wx.sys.sunset;
  // OpenWeatherMap's metric units give wind speed in m/s
  const windSpeed = wx.wind?.speed * 3.6;
  const windy = windSpeed > WIND_THRESHOLD;
  const temp = wx.main?.temp;
  const temperatureColor = temp <= COLD_TEMP ? 'blue' : temp >= HOT_TEMP ? 'orangered' : LIGHTBLACK;
  return (
    <Typography variant="body2" component="div" sx={{ color: LIGHTBLACK, mt: 1 }}>
      {wx.weather.map(weather => (
        <i key={weather.id} className={getWeatherIcon(weather.id, nightTime)} title={weather.description} />
      ))}
      <i style={{ paddingRight: 4 }} className={`wi ${nightTime ? 'wi-sunrise' : 'wi-sunset'}`} title={nightTime ? 'sunrise' : 'sunset'} />
      {timeFormat.format(sunChange * 1000)}
      {temp != null && (
        <span className="wi" style={{ font: 'inherit', color: temperatureColor }}>{Math.round(temp)}°C</span>
      )}
      {windy && (
        <>
          <i style={{ paddingRight: 4 }} className="wi wi-strong-wind" title="wind speed" />
          <span style={{ paddingRight: 4 }}>{`${Math.round(windSpeed)} km/h`}</span>
          <i style={{ display: 'inline-block', transform: `rotate(${meteo2rotation(wx.wind.deg)}deg)` }} className="wi wi-wind-direction" title="wind direction" />
        </>
      )}
    </Typography>
  );
}
