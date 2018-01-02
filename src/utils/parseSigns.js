const _ = require('lodash')
const moment = require('moment-timezone')

const currentMessage = (message) => {
  return message
  .replace(/(\[jl4\])/g, '\t')
  .replace(/(\[nl\])/g, '\n')
  .replace(/(\[np\])/g, '\n\n')
  .trim()
}

const lastUpdate = (time) => {
  return moment(time)
}

const parseSigns = (signs) => {
  const parse_props = ['lat', 'lon']
  const transformers = {
    'current-message': currentMessage,
    'last-update': lastUpdate
  }
  signs.forEach(sign => {
    Object.keys(sign).forEach(key => {
      let stripped_key = key.replace(new RegExp("^tns:"), '')
      sign[stripped_key] = sign[key][0];
      if (_.includes(parse_props, stripped_key)) {
        sign[stripped_key] = JSON.parse(sign[key])
      }
      if (_.includes(Object.keys(transformers), stripped_key)) {
        sign[stripped_key] = transformers[stripped_key](sign[stripped_key])
      }
      delete sign[key]
    })
  })
  return signs
}

if (module) {
  module.exports = parseSigns
}
