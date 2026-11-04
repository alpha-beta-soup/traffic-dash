import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import overlayChip from './overlayChip';
import { describeWind, getWeatherIcon, sunEvent } from '../utils';

const COLD_TEMP = 3;
const HOT_TEMP = 30;
// Strong wind stands out as a warning, readable on either theme
const warningText = theme => theme.palette.warning[theme.palette.mode === 'dark' ? 'light' : 'dark'];

// The font's sky icons (clouds, sun and so on) sit high beside the text; lowered to level with it.
// Its wind icons already are.
const SKY = { verticalAlign: '-0.15em' };

// Sunrise or sunset, in the camera's (New Zealand's) time, 12- or 24-hour as the browser does
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: 'Pacific/Auckland' });

// A camera's weather: its sky (and the sun's time, near sunrise or sunset), temperature and
// wind. alwaysShowWind: show the wind even when it's light (otherwise only when windy). `chip`:
// as a chip over the camera's image (the cards'), shorter: the wind without its direction's name.
export default function CameraWeather({ data: wx, alwaysShowWind = false, chip = false }) {
  if (!wx) return null;
  const now = Date.now() / 1000;
  const nightTime = now < wx.sys.sunrise || now > wx.sys.sunset;
  const sun = sunEvent(wx.sys, now); // Only near sunrise or sunset: sunstrike and frost
  const wind = describeWind(wx.wind);
  const temp = wx.main?.temp;
  const temperatureColor = temp <= COLD_TEMP ? 'info.main' : temp >= HOT_TEMP ? 'error.main' : 'inherit';
  const parts = (
    <>
      {wx.weather.map(weather => (
        <i key={weather.id} className={getWeatherIcon(weather.id, nightTime)} title={weather.description} style={SKY} />
      ))}
      {sun && (
        <>
          <i style={{ ...SKY, paddingRight: 4 }} className={`wi wi-${sun.type}`} title={sun.type} />
          {timeFormat.format(sun.time * 1000)}
        </>
      )}
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
              {!chip && <span style={{ paddingLeft: 4 }}>{`from ${wind.from.label}`}</span>}
            </>
          )}
        </Box>
      )}
    </>
  );
  if (chip) {
    return (
      <Box
        sx={{
          ...overlayChip, display: 'inline-flex', alignItems: 'center', px: 1, borderRadius: 10, color: 'text.primary', whiteSpace: 'nowrap',
          '& .wi': { fontSize: '1.1em' },
          '& .wi + .wi': { ml: 0.75 }, // Closer than in a line of text
        }}
      >
        {parts}
      </Box>
    );
  }
  return <Typography variant="body2" component="div" sx={{ color: 'text.secondary', mt: 1 }}>{parts}</Typography>;
}
