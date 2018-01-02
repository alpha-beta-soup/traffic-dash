import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from 'material-ui/styles';
import AppBar from 'material-ui/AppBar';
import Toolbar from 'material-ui/Toolbar';
import Typography from 'material-ui/Typography';
import Clock from 'react-live-clock';

const styles = theme => ({
  root: {
    width: '100%',
  },
});

function SimpleAppBar(props) {
  const { classes } = props;
  return (
    <div className={classes.root}>
      <AppBar position="static" color="default">
        <Toolbar>
          <Typography type="title" color="inherit" style={{width: "20%"}}>
            NZ Traffic Dashboard
          </Typography>
          <Typography type="title" color="inherit" style={{width: "60%", textAlign: "center"}}>
            <Clock format={'dddd DD/MM/YYYY h:mm:ss A'} ticking={true} />
          </Typography>
          <Typography type="subheading" color="secondary" style={{width: "20%", textAlign: "right"}}>
            v{process.env.npm_package_version}
          </Typography>
        </Toolbar>
      </AppBar>
    </div>
  );
}

SimpleAppBar.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(SimpleAppBar);
