import { useEffect, useState } from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import Arrow from './Arrow';
import { CountList } from './CountPopup';
import { fetchJson, nearestTo, placesOf } from '../utils';

const MAX_KM = 1; // Further off, it's likely another road, or traffic that turned off before it

// Every counting site, fetched once a page load: they change daily at most
let allSites;
const fetchSites = () => {
  allSites ??= fetchJson('/api/traffic-counts');
  allSites.catch(() => { allSites = undefined; }); // Tried again next time
  return allSites;
};

// NZTA's counting place nearest the camera (often both directions of the road, or an interchange's
// ramps too), if it's close: real counts of the traffic passing, to set the camera's vehicles in
// view against
export default function NearbyCounts({ camera }) {
  const [sites, setSites] = useState(null);
  useEffect(() => {
    let current = true;
    fetchSites().then(all => current && setSites(all)).catch(() => {});
    return () => { current = false; };
  }, []);
  const [nearest] = sites ? nearestTo(camera, sites, { limit: 1, maxKm: MAX_KM }) : [];
  if (!nearest) return null;
  const here = placesOf(sites).find(place => place.includes(nearest.item)); // As the map groups them
  const metres = Math.round((nearest.km * 1000) / 10) * 10;
  return (
    <Paper sx={{ p: 2, mt: 2 }}>
      <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>Traffic counted nearby</Typography>
      <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mb: 1 }}>
        NZTA&apos;s counting site {metres} m <Arrow bearing={nearest.direction.bearing} /> {nearest.direction.label}: vehicles passing it each day,
        days late
      </Typography>
      <CountList sites={here} longTerm />
    </Paper>
  );
}
