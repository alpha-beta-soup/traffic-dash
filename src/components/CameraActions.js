import React from 'react'
import moment from 'moment-timezone'
import { CardActions } from 'material-ui/Card'
import Button from 'material-ui/Button'
import Typography from 'material-ui/Typography'

moment.locale('en-nz')

class CameraActions extends React.Component {
  constructor(props) {
    super(props)
  }
  render() {
    return (
      <CardActions>
        <Button onClick={(event) => this.props.share(event)} dense color="primary">
          <Typography type="button">
            Share
          </Typography>
        </Button>
        <Button onClick={(event) => this.props.focus(event)} dense color="primary">
          <Typography type="button">
            Focus
          </Typography>
        </Button>
        <Button onClick={(event) => this.props.animate(event)} dense color="primary">
          <Typography type="button">
            {!this.props.isAnimating ? (this.props.animationFrame > 0 ? 'Resume' : 'Animate') : 'Stop'}
          </Typography>
        </Button>
      </CardActions>
    )
  }
}


export default CameraActions
