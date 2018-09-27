import React from 'react';
import axios from 'axios';
import _ from 'lodash';
import { parseString as xml2js } from 'xml2js';
import Grid from 'material-ui/Grid';
import env from 'node-env-file';

import { withStyles } from 'material-ui/styles';
import Typography from 'material-ui/Typography';

import Camera from './Camera';
import Map from './Map';
import SnackBar from './SnackBar';

import {
  CAMERA_RADIUS,
  CAMERA_LIMIT,
} from '../consts';

import {
  parseCameras,
  parseSigns,
  parseGeojsonCameras,
  parseGeojsonSigns,
  filterCamerasByBoundingBox,
} from '../utils';

env('.env');


class AppGrid extends React.Component {
  constructor(props) {
    super(props);
    this.focus = this.focus.bind(this);
    this.pin = this.pin.bind(this);
    this.updateMapExtent = this.updateMapExtent.bind(this);
    this.getCameras = this.getCameras.bind(this);
    this.getVMS = this.getVMS.bind(this);
    this.state = {
      variableMessageSigns: [],
      cameras: [],
      allCameras: [],
      pinnedCameras: [],
      mapCentre: null,
      mapZoom: null,
      boundingBox: null,
      cameraAPIError: {},
    };
  }
  getCameras() {
    const instance = axios.create({
      baseURL: 'https://infoconnect1.highwayinfo.govt.nz:443/ic/jbi/TrafficCameras2/REST/FeedService/',
      timeout: 1000,
      headers: { username: process.env.INFOCONNECT_USER, password: process.env.INFOCONNECT_PW },
    });
    instance.post().then((res) => {
      xml2js(res.data, (err, data) => {
        const parsedCameras = parseCameras(data['tns:getCamerasResponse']['tns:camera']);
        parsedCameras.forEach((camera) => {
          camera.weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${camera.lat}&lon=${camera.lon}&units=metric&appid=${process.env.OPENWEATHERMAP_APIKEY}`;
          camera.trafficUrl = `https://api.mapbox.com/v4/mapbox.mapbox-traffic-v1/tilequery/${camera.lon},${camera.lat}.json?radius=${CAMERA_RADIUS}&limit=${CAMERA_LIMIT}&&access_token=${process.env.MAPBOX_TOKEN}`;
        });
        this.setState({
          cameras: parsedCameras,
          allCameras: parsedCameras,
        });
      });
    }).catch((error) => {
      if (error.response) {
        console.error(error.response);
        const existingError = this.state.cameraAPIError.status >= 400;
        this.setState({ cameraAPIError: {
          status: error.response.status,
          message: `${existingError ? 'Again, sorry' : 'Sorry'}, the traffic cameras failed to load: ${error.response.status} ${error.response.statusText}`,
        } });
      }
    });
  }
  getVMS() {
    const signs = [];
    const instance = axios.create({
      baseURL: 'https://infoconnect1.highwayinfo.govt.nz/ic/jbi/VariableMessageSigns2/REST/FeedService/',
      timeout: 1000,
      headers: { username: process.env.INFOCONNECT_USER, password: process.env.INFOCONNECT_PW },
    });
    const isValidSign = sign => sign['current-message'].length;
    instance.post().then((res) => {
      xml2js(res.data, (err, data) => {
        const parsedSigns = _.filter(parseSigns(data['tns:getSignsResponse']['tns:sign']), sign => isValidSign(sign));
        this.setState({
          variableMessageSigns: parsedSigns,
        });
      });
    });
  }
  focus(location) {
    this.setState({
      mapCentre: location || null,
    }, () => {
      // Scroll to top, where the map is
      window.scrollTo(0, 0);
    });
  }
  pin(cameraId) {
    // console.log('pin!', { cameraId, state: this.state });
    const newlyPinnedCamera = this.state.allCameras.find(camera => camera.id === cameraId);
    if (!newlyPinnedCamera) {
      console.error(`Failed to pin camera ${cameraId}`);
    }
    let pinnedCameras = this.state.pinnedCameras;
    if (!this.state.pinnedCameras.includes(newlyPinnedCamera)) {
      pinnedCameras = _.union(pinnedCameras, [newlyPinnedCamera]);
    } else {
      pinnedCameras = _.without(pinnedCameras, newlyPinnedCamera);
    }
    this.setState({
      pinnedCameras,
    });
  }
  updateMapExtent(bounds) {
    if (bounds) {
      const cameras = [...new Set(
        filterCamerasByBoundingBox(this.state.allCameras, bounds).concat(this.state.pinnedCameras),
      )];
      this.setState({ cameras });
    }
  }
  componentDidMount() {
    this.getCameras();
    this.getVMS();
  }

  render() {
    return (
      <div className={this.props.root}>
        <Grid container spacing={8} direction={'row'} alignContent={'center'} justify={'space-between'} alignItems={'stretch'}>
          <Grid item xs={12} lg={this.state.cameraAPIError ? 12 : 6}>
            <Map
              cameras={parseGeojsonCameras(this.state.allCameras)}
              focus={this.focus}
              signs={parseGeojsonSigns(this.state.variableMessageSigns)}
              centre={this.state.mapCentre}
              updateMapExtent={this.updateMapExtent}
            />
          </Grid>
          {!this.state.cameras.length ? null :
           this.state.cameras.length <= 10 ?
            _.map(
              this.state.cameras,
              camera => (<Grid key={camera.id} item xs={12} sm={6} md={4} lg={2}>
                <Camera
                  focus={this.focus}
                  pin={this.pin}
                  pinned={!!this.state.pinnedCameras.find(pinnedCamera => camera === pinnedCamera)}
                  {...camera}
                />
              </Grid>),
            )
            : <Grid item xs={12} style={{ textAlign: 'center' }}><Typography>Too many cameras in view, please zoom in or pan first</Typography></Grid>
          }
          {this.state.cameraAPIError.status >= 400 &&
            <SnackBar
              message={this.state.cameraAPIError.message}
              action={this.getCameras}
              actionLabel={'retry'}
            />
          }
        </Grid>
      </div>
    );
  }
}

const styles = theme => ({
  root: {
    flexGrow: 1,
    marginTop: 30,
  },
  paper: {
    padding: 16,
    textAlign: 'center',
    color: theme.palette.text.secondary,
  },
});

export default withStyles(styles)(AppGrid);
