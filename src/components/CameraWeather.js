import React from 'react'
import moment from 'moment-timezone'
import Typography from 'material-ui/Typography'

import { getWeatherIcon } from '../utils'

moment.locale('en-nz')

import {
  LIGHTBLACK
} from '../consts'

const windThreshold = 20
const coldTemp = 3
const hotTemp = 30

// Converts meteorological direction ("direction from") to a symbol rotation,
// assuming the symbol points "up" or "to the north" at 0 degrees (no rotation)
const meteo2rotation = (d) => (Math.round(d) + 180) % 360

class CameraTime extends React.Component {
  constructor(props) {
    super(props)
  }
  render() {
    const wx = this.props.data
    console.debug({wx})
    const nightTime = wx && (moment().unix() < wx.sys.sunrise || moment().unix() > wx.sys.sunset)
    const sunChangeLabel = (unixTime) => moment(unixTime).tz(moment.tz.guess()).format("HH:mm")
    const sunChangeIcon = nightTime ? 'wi-sunrise' : 'wi-sunset'
    if (wx) console.debug({icon: getWeatherIcon(wx.weather[0].id, nightTime), nightTime})
    const wind = wx && wx.wind.speed && wx.wind.speed > windThreshold ? wx.wind : null
    const windRotation = wind && `rotate(${meteo2rotation(wx.wind.deg)}deg)`
    const temperatureColor = wx && wx.main.temp <= coldTemp ? 'blue' : wx && wx.main.temp >= hotTemp ? 'orangered' : LIGHTBLACK
    return (
      wx && <Typography type="body2" style={{color: LIGHTBLACK}}>
        {wx.weather.map((weather) => {
          return <i className={getWeatherIcon(weather.id, nightTime)} title={weather.description}></i>
        })}
        <i style={{paddingRight: 4}} className={'wi ' + sunChangeIcon} title={nightTime ? 'sunrise' : 'sunset'}></i>
        {nightTime ? sunChangeLabel(wx.sys.sunrise*1000) : sunChangeLabel(wx.sys.sunset*1000)}
        {wx.main.temp ? <span className='wi' style={{font: 'inherit', color: temperatureColor}}>{Math.round(wx.main.temp)}°C</span> : null}
        {wind ? <i style={{paddingRight: 4}} className='wi wi-strong-wind' title='wind speed'></i> : null}
        {wind ? <span style={{paddingRight: 4, font: 'inherit', textTransform: 'lowercase'}}>{`${Math.round(wind.speed)} km/h`}</span> : null}
        {wind ? <i style={{display: 'inline-block', transform: windRotation}} className='wi wi-wind-direction' title='wind direction'></i> : null}
      </Typography>
    )
  }
}

export default CameraTime
