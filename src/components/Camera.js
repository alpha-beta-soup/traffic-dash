import React from 'react'
import axios from 'axios'
import moment from 'moment-timezone'
import clipboardy from 'clipboardy'
import { withStyles } from 'material-ui/styles'
import Card from 'material-ui/Card'

import CameraMedia from './CameraMedia'
import CameraTime from './CameraTime'
import CameraContent from './CameraContent'
import CameraActions from './CameraActions'
import CameraSnackBar from './CameraShared'

const fs = require('fs')
import env from 'node-env-file'
moment.locale('en-nz')

env('.env');
import {
  aws,
  getS3ImageURL,
  saveJpegBufferLocally,
  replaceAll ,
  listImagesInImageCacheDir,
  listImagesInS3,
  uploadJpegBufferToS3,
  getImageFromLocalCache,
  sortAndFilterRoads,
  calculateOverallCongestion,
  encodeS3URI,
  getRandomInt
} from '../utils'

import {
  congestionEnum,
  localCache,
  trafficEnum,
  USE_LOCAL_CACHE,
  LOADING,
  ANIMATION_FRAME,
  BLACK,
  LIGHTBLACK,
  descriptionReplace
} from '../consts'

class Camera extends React.Component {
  constructor(props) {
    super(props);
    this.handleFocusClick = this.handleFocusClick.bind(this)
    this.handleShareClick = this.handleShareClick.bind(this)
    this.handleAnimateClick = this.handleAnimateClick.bind(this)
    this.handleSnackbarClose = this.handleSnackbarClose.bind(this)
    this.loadTrafficInterval = false
    this.loadImageInterval = false
    this.advanceAnimationFrame = false
    this.state = {
      isAnimating: false,
      animationFrame: 0,
      nullImage: false,
      loaded: false,
      imgDate: null,
      src: null,
      snackbarOpen: false,
      congestion: null,
      weather: null,
      cacheDir: localCache
    }
  }
  componentDidMount() {
    console.debug(`Camera ${this.props.id} (${this.props.name}) did mount`)
    this.getImageData()
    this.getWeatherData() // Only once
    this.getTrafficData()
    if (!this.loadImageInterval) {
      const imageTimeout = getRandomInt(parseInt(process.env.MIN_REFRESH), parseInt(process.env.MAX_REFRESH))
      let timeoutFunc = function() {this.handleImageTimeout()}.bind(this)
      this.loadImageInterval = setInterval(timeoutFunc, imageTimeout)
    }
    if (!this.loadTrafficInterval) {
      const trafficTimeout = getRandomInt(parseInt(process.env.MIN_TRAFFIC_REFRESH), parseInt(process.env.MAX_TRAFFIC_REFRESH))
      let timeoutFunc = function() {this.handleTrafficTimeout()}.bind(this)
      this.loadTrafficInterval = setInterval(timeoutFunc, trafficTimeout)
    }
  }
  componentWillUnmount() {
    console.debug(`Camera ${this.props.id} (${this.props.name}) will unmount`)
    // Clear data timeouts when unmounted
    this.loadImageInterval && clearInterval(this.loadImageInterval)
    this.loadTrafficInterval && clearInterval(this.loadTrafficInterval)
    this.advanceAnimationFrame && clearInterval(this.advanceAnimationFrame)
    this.loadImageInterval = false
    this.loadTrafficInterval = false
    this.advanceAnimationFrame = false
  }
  handleImageTimeout() {
    this.getImageData()
  }
  handleTrafficTimeout() {
    this.getTrafficData()
  }
  getTrafficData() {
    console.debug(`getTrafficData for ${this.props.id} (${this.props.name})`)
    axios.get(
      this.props.trafficUrl
    ).then(traffic => {
      this.setState({
        congestion: traffic.status !== 200 ? null : calculateOverallCongestion(sortAndFilterRoads(traffic.data))
      });
    }).catch(err => {
      console.error(err);
    })
  }
  getWeatherData() {
    console.debug(`getTrafficData for ${this.props.id} (${this.props.name})`)
    axios.get(
      this.props.weatherUrl
    ).then(weather => {
      this.setState({
        weather: weather.status !== 200 ? null : weather.data
      })
    }).catch(err => {
      console.error(err)
    })
  }
  getImageData() {
    console.debug(`getImageData for ${this.props.id} (${this.props.name}) [animating: ${this.state.isAnimating}]`)
    if (this.props.offline || this.props.underMaintenance) {
      console.debug(this.props);
      console.debug(`Camera ${this.props.id} is not operational`);
      if (!this.state.isAnimating) this.setState({nullImage: true});
      return
    }
    axios.get(
      this.props.imageUrl,
      {responseType: 'arraybuffer'}
    ).then(nzta => {
      const success = nzta.status === 200;
      if (!success) {
        throw new Error(`${nzta.status} ${nzta.data}`)
      }
      const imgDate = new Date(nzta.headers['last-modified'])
      if (!this.state.isAnimating) {
        this.setState({
          nullImage: false,
          imgDate,
          src: this.props.imageUrl+'?'+encodeURIComponent(nzta.headers.etag)
        });
      }
      return {buffer: new Buffer(nzta.data), imgDate};
    }).then(data => {
      if (!data) return
      let path = [this.props.id, data.imgDate].join('/') + '.jpg'
      if (USE_LOCAL_CACHE) path = [localCache, path].join('/')
      let saveFunc = USE_LOCAL_CACHE ? saveJpegBufferLocally : uploadJpegBufferToS3
      return saveFunc(path, data.buffer)
    }).then(src => {
      if (!src) return
      if (!this.state.isAnimating) this.setState({src, loaded: true})
    }).catch(err => {
      console.error(err);
      if (!this.state.isAnimating) this.setState({nullImage: true});
    })
  }
  handleFocusClick(event) {
    if (event) {
      this.props.focus([this.props.lon, this.props.lat]);
    }
    return
  }
  handleShareClick(event) {
    if (event) {
      clipboardy.write(
        this.props.viewUrl
      ).then(() => {
        this.setState({snackbarOpen: true});
      })
    }
    return
  }
  handleAnimateClick(event) {
    // NOTE this while thing is pretty messed up!
    // A late night was spent here and it was fun but not pretty
    if (event) {
      const animate = !this.state.isAnimating
      if (!animate) {
        this.advanceAnimationFrame && clearInterval(this.advanceAnimationFrame)
        this.setState({isAnimating: false})
        this.getImageData()
        return
      }
      const listImagePromise = USE_LOCAL_CACHE ? listImagesInImageCacheDir : listImagesInS3
      const makeImgSrc = USE_LOCAL_CACHE ? getImageFromLocalCache : getS3ImageUrl
      // When not animating, the application will continue to poll the NZTA API
      // and store images to the cache -- just without updating certain
      // bits of state as it does it.
      // In the meantime, we just loop the cache directory for the camera and
      // change state to progress the frames
      listImagePromise(this.props.id, moment.duration(6, 'hours'))
      .then(images => {
        let frame = this.state.animationFrame
        if (!images.length || !images[frame]) {
          this.setState({isAnimating: false})
          return
        }
        let fileName = images[frame].split('/')[1]
        let src = makeImgSrc(this.props.id, fileName)
        this.setState({
          isAnimating: true,
          imgDate: decodeURIComponent(images[frame].split('.')[0].split('/')[1]),
          nullImage: false,
          loaded: true,
          src
        })
        this.advanceAnimationFrame = setInterval(function() {
          let nextFrame = this.state.animationFrame + 1
          if (nextFrame >= images.length) {
            // No more frames to animate
            clearInterval(this.advanceAnimationFrame)
            this.advanceAnimationFrame = false
            this.setState({
              isAnimating: false,
              animationFrame: 0
            })
            this.getImageData()
          }
          let nextImage = images[nextFrame]
          if (!nextImage) return
          let fileName = nextImage.split('/')[1]
          let src = makeImgSrc(this.props.id, fileName)
          this.setState({
            src,
            imgDate: decodeURIComponent(nextImage.split('.')[0].split('/')[1]),
            animationFrame: nextFrame
          })
        }.bind(this), ANIMATION_FRAME)
      })
    }
    return
  }
  handleSnackbarClose() {
    this.setState({snackbarOpen: false});
  }
  render() {
    // The NZTA cameras often say they are taking images in the future...
    const cameraReportedTime = (moment(this.state.imgDate, 'ddd MMM M HH:mm:ss [GMT]Z [(NZDT)]') > moment()) ? moment() : this.state.imgDate
    const congestionColor = this.state.congestion ? this.state.congestion.color : null
    const congestionScore = this.state.congestion ? this.state.congestion.score : 'unknown'
    return (
      <Card key={this.props.id} className={this.props.card}>
        <CameraMedia
          src={this.state.src || LOADING}
          color={congestionColor}
          title={`${this.props.name}\nFree-flow score: ${congestionScore}%`}
        />
        <CameraTime time={cameraReportedTime}/>
        <CameraContent name={this.props.name} weather={this.state.weather} description={replaceAll(this.props.description, descriptionReplace)}/>
        <CameraActions
          share={this.handleShareClick}
          focus={this.handleFocusClick}
          animate={this.handleAnimateClick}
          isAnimating={this.state.isAnimating}
          animationFrame={this.state.animationFrame}
        />
        <CameraSnackBar
          open={this.state.snackbarOpen}
          name={this.props.name}
          closeHandler={this.handleSnackbarClose}
        />
      </Card>
    );
  }
}

const styles = theme => ({
  card: {
    maxWidth: 345,
  },
  media: {
    height: '200px'
  }
});


export default withStyles(styles)(Camera);
