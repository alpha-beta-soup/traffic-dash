// bounds is a maplibre LngLatBounds
export default function filterCamerasByBbox(cameras, bounds) {
  return cameras.filter(camera => bounds.contains([camera.lon, camera.lat]));
}
