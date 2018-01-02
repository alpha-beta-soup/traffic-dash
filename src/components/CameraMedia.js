import React from 'react'
import { withStyles } from 'material-ui/styles'
import { CardMedia } from 'material-ui/Card'

class CameraMedia extends React.Component {
  constructor(props) {
    super(props)
  }
  render() {
    return (
      <CardMedia
        style={{height: '25.5vh', borderWidth: '0 0 8px 0', borderStyle: 'solid', borderColor: `${this.props.color}`}}
        className={this.props.media}
        component={'img'}
        src={this.props.src}
        title={this.props.title}
      />
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


export default withStyles(styles)(CameraMedia)
