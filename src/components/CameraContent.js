import React from 'react'
import { withStyles } from 'material-ui/styles'
import { CardContent } from 'material-ui/Card'
import Typography from 'material-ui/Typography'

import CameraWeather from './CameraWeather'

import {
  BLACK, LIGHTBLACK
} from '../consts'

class CameraContent extends React.Component {
  constructor(props) {
    super(props)
  }
  render() {
    return (
      <CardContent
        style={{height: '10vh'}}
      >
        <Typography type="title" style={{color: BLACK}}>
          {this.props.name}
        </Typography>
        <Typography type="body1" style={{color: LIGHTBLACK}}>
          {this.props.description}
        </Typography>
        <CameraWeather data={this.props.weather}/>
      </CardContent>
    )
  }
}

const styles = theme => ({
  card: {
    maxWidth: 345,
  },
  media: {
    height: '200px'
  }
})


export default withStyles(styles)(CameraContent)
