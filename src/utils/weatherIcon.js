import weatherIcons from '../../data/icons.json'

// https://gist.github.com/tbranyen/62d974681dea8ee0caa1#file-icons-json
module.exports = (code, night) => {
  let prefix = 'wi wi-'
  let icon = weatherIcons[code].icon
  if (code === 800) {
    icon = night ? 'clear' : 'sunny'
  }
  if (!((699 < code && code < 800) || (899 < code && code < 1000))) {
    // 7xx and 9xx do not get day/night prefixes
    icon = `${night ? 'night' : 'day'}-` + icon;
  }
  return prefix + icon
}
