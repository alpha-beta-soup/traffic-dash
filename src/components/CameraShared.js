import React from 'react'
import Snackbar from 'material-ui/Snackbar'
import Slide from 'material-ui/transitions/Slide'
import IconButton from 'material-ui/IconButton'
import CloseIcon from 'material-ui-icons/Close'


function TransitionRight(props) {
  return <Slide direction="right" {...props} />
}

class CameraSnackBar extends React.Component {
  constructor(props) {
    super(props)
  }
  render() {
    return (
      <Snackbar
        open={this.props.open}
        transition={TransitionRight}
        autoHideDuration={4750}
        onRequestClose={this.props.closeHandler}
        SnackbarContentProps={{
          'aria-describedby': 'message-id'
        }}
        message={<span id="message-id">Link for the {this.props.name} camera copied to the clipboard!</span>}
        action={[
          <IconButton
            key="close"
            aria-label="Close"
            color="inherit"
            onClick={this.props.closeHandler}
          >
            <CloseIcon/>
          </IconButton>
        ]}
      />
    )
  }
}

export default CameraSnackBar
