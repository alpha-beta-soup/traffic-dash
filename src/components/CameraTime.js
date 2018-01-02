import React from 'react'
import moment from 'moment-timezone'
import Typography from 'material-ui/Typography'

moment.locale('en-nz')

import {
  BLACK
} from '../consts'

class CameraTime extends React.Component {
  constructor(props) {
    super(props)
  }
  render() {
    return (
      <div style={{transform: 'translate(0, -26vh)', display: 'flex', justifyContent: 'flex-end', paddingRight: 2}}>
        <Typography style={{fontSize: '60%', paddingLeft: 5, paddingRight: 5, color: BLACK, borderRadius: 50, backgroundColor: 'white', opacity: 0.8}}>
          {moment(this.props.time).fromNow()}
        </Typography>
      </div>
    )
  }
}

export default CameraTime
