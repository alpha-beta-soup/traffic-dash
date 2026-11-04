import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';

import useLatest from '../hooks/useLatest';
import { addLayers, greyWater } from '../map/layers';
import maplibregl, { mapControls, mapControlsDark } from '../map/maplibre';
import { addSignHover, setSigns, startSignPaging } from '../map/signs';
import { cameraPath, navigate } from '../router';
import { TOUCH as TOUCH_QUERY } from '../consts';
import { groupCameraSites, warningFeatures } from '../utils';

const ZOOM = 13;
const NZTA_ATTRIBUTION = 'Cameras: <a href="https://www.journeys.nzta.govt.nz/" target="_blank" rel="noopener">Waka Kotahi NZ Transport Agency</a>';
const RING = { light: '#1976d2', dark: '#90caf9' };

const point = ([lon, lat], properties = {}) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties });
const collection = features => ({ type: 'FeatureCollection', features });
const siteIdsOf = site => String(site.cameraIds).split(',').map(Number);

// A small map around a camera on its page: the traffic, road events, weather warnings, message signs and the other camera sites
// nearby, with this camera's site ringed. Clicking another site goes to its camera, preferring
// the one facing the same way as this one. Once settled, `onMoveEnd` gets the map's centre
// ([lon, lat]), or null when that's back where it started (the first camera shown).

const TOUCH = window.matchMedia?.(TOUCH_QUERY).matches; // A device that can't hover

export default function CameraMap({
  camera, cameras, events, signs, warnings, styleUrl, dark, traffic, onMoveEnd,
}) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const camerasRef = useLatest(cameras);
  const cameraRef = useLatest(camera);
  const centre = [camera.lon, camera.lat];
  const centreRef = useLatest(centre);
  const start = useRef(centre);
  const onMoveEndRef = useLatest(onMoveEnd);
  const reportCentre = useLatest(([lon, lat]) => {
    const [startLon, startLat] = start.current;
    const atStart = Math.abs(lon - startLon) < 1e-6 && Math.abs(lat - startLat) < 1e-6;
    onMoveEndRef.current?.(atStart ? null : [lon, lat]);
  });

  useEffect(() => {
    const map = new maplibregl.Map({
      container: container.current,
      style: styleUrl,
      transformStyle: (previous, style) => greyWater(style, dark),
      center: centreRef.current,
      zoom: ZOOM,
      attributionControl: false,
      // A wheel over the map scrolls the page; the buttons zoom. On a touchscreen, one finger
      // scrolls the page too, and two move the map (it says so), which pinching zooms.
      scrollZoom: false,
      cooperativeGestures: TOUCH,
      dragRotate: false,
      pitchWithRotate: false,
    });
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: NZTA_ATTRIBUTION }));
    if (!TOUCH) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.ScaleControl(), 'bottom-left');
    map.on('load', () => {
      // Compact credits start open; on a map this small, start them folded to their ⓘ button
      container.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      addLayers(map, traffic, dark);
      map.addSource('current', { type: 'geojson', data: collection([]) });
      map.addLayer({
        id: 'current',
        type: 'circle',
        source: 'current',
        paint: {
          'circle-radius': 15,
          'circle-color': 'transparent',
          'circle-stroke-color': RING[dark ? 'dark' : 'light'],
          'circle-stroke-width': 3,
        },
      }, 'cameras');
      setLoaded(true);
    });

    const siteAt = e => siteIdsOf(e.features[0].properties);
    map.on('mouseenter', 'cameras', (e) => {
      const ids = siteAt(e);
      map.getCanvas().style.cursor = ids.includes(cameraRef.current.id) ? '' : 'pointer';
    });
    map.on('mouseleave', 'cameras', () => { map.getCanvas().style.cursor = ''; });
    addSignHover(map, undefined, TOUCH);
    map.on('moveend', () => {
      const { lng, lat } = map.getCenter();
      reportCentre.current([lng, lat]);
    });
    map.on('click', 'cameras', (e) => {
      const ids = siteAt(e);
      if (ids.includes(cameraRef.current.id)) return;
      const site = camerasRef.current.filter(c => ids.includes(c.id));
      const target = site.find(c => c.direction === cameraRef.current.direction) ?? site[0];
      if (target) navigate(cameraPath(target.id));
    });

    return () => {
      setLoaded(false);
      mapRef.current = null;
      map.remove();
    };
  }, [styleUrl, dark, traffic, centreRef, cameraRef, camerasRef, reportCentre]);

  // Moving to another camera pans there, rather than starting a new map. Reported straight
  // away, in case the page is left before the map gets there.
  useEffect(() => {
    mapRef.current?.easeTo({ center: centreRef.current, duration: 800 });
    reportCentre.current(centreRef.current);
  }, [camera.lon, camera.lat, centreRef, reportCentre]);

  useEffect(() => {
    if (!loaded) return;
    const sites = groupCameraSites(cameras);
    const map = mapRef.current;
    map.getSource('cameras').setData(collection(sites.map(({ lat, lon, ...site }) => point([lon, lat], site))));
    const here = sites.find(site => siteIdsOf(site).includes(camera.id));
    map.getSource('current').setData(collection(here ? [point([here.lon, here.lat])] : []));
  }, [loaded, cameras, camera.id]);

  useEffect(() => {
    if (!loaded) return;
    mapRef.current.getSource('event-icons').setData(collection(events.map(({ id, impact, lat, lon }) => point([lon, lat], { id, impact }))));
  }, [loaded, events]);

  useEffect(() => {
    if (loaded) mapRef.current.getSource('weather-warnings').setData(warningFeatures(warnings));
  }, [loaded, warnings]);

  useEffect(() => {
    if (loaded) setSigns(mapRef.current, signs);
  }, [loaded, signs]);

  useEffect(() => (loaded ? startSignPaging(mapRef.current) : undefined), [loaded]);

  return (
    <Paper sx={{
      mt: 2, overflow: 'hidden', ...mapControls, ...(dark && mapControlsDark),
    }}
    >
      <Box ref={container} sx={{ width: '100%', height: 240 }} />
    </Paper>
  );
}
