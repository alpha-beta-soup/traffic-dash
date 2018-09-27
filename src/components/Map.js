import React from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { withStyles } from 'material-ui/styles';
import Paper from 'material-ui/Paper';
import Button from 'material-ui/Button';
import ReactMapboxGl, { GeoJSONLayer, ZoomControl, ScaleControl, RotationControl } from 'react-mapbox-gl';
import env from 'node-env-file';

env('.env');

const styles = theme => ({
  paper: {
    padding: 16,
    textAlign: 'center',
    color: theme.palette.text.secondary,
  },
});

// const DEFAULT_LOCATION = [174.7633, -37.8485] // Auckland
const DEFAULT_LOCATION = [174.787, -41.272]; // Wellington
const DEFAULT_MAP_STYLE = 'mapbox://styles/alpha-beta-soup/cja0m89tt9n6i2sp4oi0vqmhy';
const GOOGLE_APIKEY = process.env.GOOGLE_APIKEY;
const MapGL = ReactMapboxGl({
  accessToken: process.env.MAPBOX_TOKEN,
});
const REGION_HIGHLIGHTS = {
  Auckland: [174.7633, -36.8484],
  Hamilton: [175.2793, -37.7870],
  Wellington: [174.7762, -41.2865],
  Christchurch: [172.6362, -43.5321],
  Dunedin: [170.5028, -45.8788],
};


class Map extends React.Component {
  constructor(props) {
    super(props);
    this.adjustBbox = this.adjustBbox.bind(this);
    this.state = {
      userLocation: DEFAULT_LOCATION,
    };
  }

  getUserLocation() {
    const instance = axios.create({
      baseURL: `https://www.googleapis.com/geolocation/v1/geolocate?key=${GOOGLE_APIKEY}`,
      timeout: 1000,
    });
    instance.post()
    .then((res) => {
      this.setState({ userLocation: [
        // res.data.location.lng, res.data.location.lat
        174.787, -41.272,
      ] });
    }).catch((error) => {
      if (error.response) {
        console.log(error.response.status);
        console.info(error.response.data);
      }
    });
    // navigator.geolocation.getCurrentPosition(geo => {
    //   let {latitude, longitude} = geo.coords
    //   this.setState({
    //     userLocation: [longitude, latitude]
    //   })
    // }, err => {
    //   console.error('Cannot retrieve user position', err)
    // })
  }
  componentDidMount() {
    this.getUserLocation();
  }
  adjustBbox(glmap, event) {
    this.props.updateMapExtent(glmap.getBounds());
  }
  render() {
    const cameraData = this.props.cameras ? (
      <GeoJSONLayer
        data={this.props.cameras}
        symbolLayout={{
          'symbol-placement': 'point',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-size': 1.25,
          'icon-pitch-alignment': 'map',
          // "icon-image": "camera",
          'icon-image': 'cinema-15',
          'icon-rotate': {
            type: 'identity',
            property: 'direction_degrees',
          },
          'icon-rotation-alignment': 'map',
          'icon-keep-upright': false,
          'text-field': '{name}',
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-offset': [0, 0.6],
          'text-anchor': 'top',
          'text-size': 11,
          'text-letter-spacing': 0.1,
          'text-padding': 3,
        }}
        symbolPaint={{
          'text-color': 'white',
          'text-halo-color': 'black',
          'text-halo-width': 0.5,
        }}
        symbolOnMouseDown={() => {}}
        symbolOnMouseUp={() => {}}
        symbolOnMouseMove={() => {}}
        symbolOnMouseEnter={() => {}}
        symbolOnMouseLeave={() => {}}
        symbolOnClick={() => {}}
      />
    ) : null;
    const signData = this.props.signs ? (
      <GeoJSONLayer
        data={this.props.signs}
        symbolLayout={{
          'text-field': '{current-message}',
          'text-font': ['Call Five L Negative OT Regular', 'Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': 13,
          'text-justify': 'center',
          'text-letter-spacing': 0.1,
          'text-anchor': 'center',
        }}
        symbolPaint={{
          'text-color': 'orange',
          'text-halo-color': 'black',
          'text-halo-width': 1,
          'text-opacity': 1,
        }}
      />
    ) : null;
    return (
      <Paper className={this.props.paper}>
        <div style={{ position: 'absolute', marginTop: 10, marginLeft: 7 }}>
          {Object.keys(REGION_HIGHLIGHTS).map(region => (
            <Button
              onClick={event => this.props.focus(REGION_HIGHLIGHTS[region])}
              variant={'raised'}
              style={{ marginRight: 4, zIndex: 1, opacity: 0.8 }}
            >
              {region}
            </Button>
            ))}
        </div>
        <MapGL
          style={DEFAULT_MAP_STYLE}
          movingMethod={'flyTo'}
          flyToOptions={{
            curve: Math.pow(6, 0.25),
          }}
          center={this.props.centre || this.state.userLocation}
          containerStyle={{
            height: '46.5vh',
            minWidth: '100%' }}
          onMoveEnd={this.adjustBbox}
          onZoom={this.adjustBbox}
          onResize={this.adjustBbox}
          onStyleLoad={this.adjustBbox}
        >
          {cameraData}
          {signData}
          <ZoomControl />
          <ScaleControl style={{ bottom: 25, right: 0, opacity: 0.5 }} />
          <RotationControl />
        </MapGL>
      </Paper>
    );
  }
}

Map.propTypes = {
  focus: PropTypes.func,
  signs: PropTypes.object,
  centre: PropTypes.array,
  updateMapExtent: PropTypes.func,
  cameras: PropTypes.object,
};

export default withStyles(styles)(Map);
