import weatherIcons from '../../data/icons.json';

// https://gist.github.com/tbranyen/62d974681dea8ee0caa1#file-icons-json
export default function getWeatherIcon(code, night) {
  let icon = weatherIcons[code]?.icon ?? 'na';
  if (code === 800) {
    icon = night ? 'clear' : 'sunny';
  }
  if (!((code > 699 && code < 800) || (code > 899 && code < 1000))) {
    // 7xx and 9xx do not get day/night prefixes
    icon = `${night ? 'night' : 'day'}-${icon}`;
  }
  return `wi wi-${icon}`;
}
