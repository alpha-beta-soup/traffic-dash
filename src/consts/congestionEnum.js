import React from 'react'
import SentimentVeryDissatisfied from 'material-ui-icons/SentimentVeryDissatisfied'
import SentimentDissatisfied from 'material-ui-icons/SentimentDissatisfied'
import SentimentNeutral from 'material-ui-icons/SentimentNeutral'
import SentimentVerySatisfied from 'material-ui-icons/SentimentVerySatisfied'


// https://www.mapbox.com/vector-tiles/mapbox-traffic-v1/
const CongestionIconStyle = {height: '200%'}

module.exports = Object.freeze({
  severe: {value: 0, description: 'Severe', color: 'hsl(350, 100%, 20%)', icon: <SentimentVeryDissatisfied style={CongestionIconStyle}/>},
  heavy: {value: 1, description: 'Heavy', color: 'hsl(0, 48%, 40%)', icon: <SentimentDissatisfied style={CongestionIconStyle}/>},
  moderate: {value: 2, description: 'Moderate', color: 'hsl(28, 52%, 40%)', icon: <SentimentNeutral style={CongestionIconStyle}/>},
  low: {value: 3, description: 'Low', color: 'hsl(145, 30%, 25%)', icon: <SentimentVerySatisfied style={CongestionIconStyle}/>}
})
