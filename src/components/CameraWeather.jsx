import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { describeWind, getWeatherIcon } from '../utils';

const COLD_TEMP = 3;
const HOT_TEMP = 30;
// Strong wind stands out as a warning, readable on either theme
const warningText = theme => theme.palette.warning[theme.palette.mode === 'dark' ? 'light' : 'dark'];

const timeFormat = new Intl.DateTimeFormat('en-NZ', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Pacific/Auckland',
});

// alwaysShowWind: show the wind even when it's light (otherwise only when windy, to keep the
// cards short)
export default function CameraWeather({ data: wx, alwaysShowWind = false }) {
  if (!wx) return null;
  const now = Date.now() / 1000;
  const nightTime = now < wx.sys.sunrise || now > wx.sys.sunset;
  const sunChange = nightTime ? wx.sys.sunrise : wx.sys.sunset;
  const wind = describeWind(wx.wind);
  const temp = wx.main?.temp;
  const temperatureColor = temp <= COLD_TEMP ? 'info.main' : temp >= HOT_TEMP ? 'error.main' : 'inherit';
  return (
    <Typography variant="body2" component="div" sx={{ color: 'text.secondary', mt: 1 }}>
      {wx.weather.map(weather => (
        <i key={weather.id} className={getWeatherIcon(weather.id, nightTime)} title={weather.description} />
      ))}
      <i style={{ paddingRight: 4 }} className={`wi ${nightTime ? 'wi-sunrise' : 'wi-sunset'}`} title={nightTime ? 'sunrise' : 'sunset'} />
      {timeFormat.format(sunChange * 1000)}
      {temp != null && (
        <Box component="span" className="wi" sx={{ font: 'inherit', color: temperatureColor }}>{Math.round(temp)}°C</Box>
      )}
      {wind && (wind.windy || alwaysShowWind) && (
        <Box
          component="span"
          title={wind.strong ? 'Strong wind: take care, especially in high-sided vehicles' : 'Wind'}
          sx={{ ml: 0.75, color: wind.strong ? warningText : 'inherit', fontWeight: wind.strong ? 500 : undefined }}
        >
          <i style={{ paddingRight: 4 }} className="wi wi-strong-wind" />
          <span style={{ paddingRight: 4 }}>
            {`${wind.speed} km/h`}
            {wind.gust && `, gusts ${wind.gust}`}
          </span>
          {wind.from && (
            <>
              {/* The arrow points the way the wind blows */}
              <i style={{ display: 'inline-block', transform: `rotate(${wind.towards}deg)` }} className="wi wi-wind-direction" />
              <span style={{ paddingLeft: 4 }}>{`from ${wind.from.label}`}</span>
            </>
          )}
        </Box>
      )}
    </Typography>
  );
}
