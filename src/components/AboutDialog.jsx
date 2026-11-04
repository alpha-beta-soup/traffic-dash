import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';

import Icon from './Icon';
import { usePhone } from '../hooks/useScreen';
import { homepage, version } from '../../package.json';

const CC_BY = 'https://creativecommons.org/licenses/by/4.0/';

const Out = ({ href, children }) => <Link href={href} target="_blank" rel="noopener">{children}</Link>;

const Heading = ({ children }) => <Typography variant="subtitle2" component="h3" sx={{ mt: 2, mb: 0.5 }}>{children}</Typography>;

// Where everything comes from (with its licence), how to read it, and the source code: the map's
// own credits are brief, and fold away on a phone
const SOURCES = [
  { what: 'Cameras, message signs and road events', from: <><Out href="https://www.journeys.nzta.govt.nz/">Waka Kotahi NZ Transport Agency</Out>, under its <Out href="https://www.journeys.nzta.govt.nz/about-this-site/terms-of-use">terms of use</Out></> },
  { what: 'Traffic counts', from: <>Waka Kotahi NZ Transport Agency’s <Out href="https://opendata-nzta.opendata.arcgis.com/">open data</Out>, <Out href={CC_BY}>CC BY 4.0</Out></> },
  { what: 'Live traffic', from: <Out href="https://www.mapbox.com/about/maps/">© Mapbox</Out> },
  { what: 'Weather warnings', from: <><Out href="https://www.metservice.com/warnings/home">© MetService</Out>, <Out href={CC_BY}>CC BY 4.0</Out></> },
  { what: 'Weather and rain', from: <Out href="https://openweathermap.org/">© OpenWeather</Out> },
  { what: 'Wind', from: <><Out href="https://open-meteo.com/">Open-Meteo</Out>, from ECMWF’s forecast, <Out href={CC_BY}>CC BY 4.0</Out></> },
  { what: 'Base map', from: <><Out href="https://openfreemap.org/">OpenFreeMap</Out>, <Out href="https://openmaptiles.org/">© OpenMapTiles</Out>, data <Out href="https://www.openstreetmap.org/copyright">© OpenStreetMap</Out> contributors</> },
  { what: 'Vehicles counted', from: <><Out href="https://github.com/Peterande/D-FINE">D-FINE</Out>, an object detection model, on the cameras’ images</> },
];

export default function AboutDialog({ open, onClose }) {
  const phone = usePhone();
  return (
    <Dialog open={open} onClose={onClose} fullScreen={phone} maxWidth="sm" scroll="paper" aria-labelledby="about-title">
      {/* Full screen on a phone, Material's way: a bar along the top, closed by its ✕ */}
      {phone ? (
        <Toolbar sx={{ gap: 1, pl: 1 }}>
          <IconButton edge="start" aria-label="Close" onClick={onClose}><Icon name="close" /></IconButton>
          <Typography variant="h6" component="h2" id="about-title" noWrap>About</Typography>
        </Toolbar>
      ) : <DialogTitle id="about-title">About the NZ Traffic Dashboard</DialogTitle>}
      <DialogContent dividers sx={{ typography: 'body2' }}>
        <Typography variant="body2">
          New Zealand’s traffic cameras, message signs, road events and weather warnings on one map, with how
          busy the roads are now, and how their traffic compares with recent years.
        </Typography>

        <Heading>Reading it</Heading>
        <Box component="ul" sx={{ m: 0, pl: 2.5, '& li': { mb: 0.75 } }}>
          <li>
            <strong>Congestion now</strong> is Mapbox’s live traffic. Each camera is matched to the roads near it,
            heading the way it looks, and its card’s border takes their colour.
          </li>
          <li>
            <strong>Traffic against recent years</strong> compares each counting site’s last week with the same days
            of the last three years, averaged: weekdays lined up, and public holidays (regional ones too) left
            out. Within 10% is “about the same”; 25% or more, “much” busier or quieter. NZTA’s counts arrive days
            late, so the newest are some days old.
          </li>
          <li>
            <strong>Vehicles, 30 min</strong> on a camera’s card is counted by a computer, from that camera’s images:
            an estimate, which misses some vehicles far off or at night.
          </li>
        </Box>

        <Heading>Where it comes from</Heading>
        <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'auto 1fr' }, columnGap: 2, rowGap: { xs: 0, sm: 0.75 } }}>
          {SOURCES.map(({ what, from }, i) => (
            <Box key={what} sx={{ display: 'contents' }}>
              <Box component="dt" sx={{ color: 'text.secondary', mt: { xs: i ? 1 : 0, sm: 0 } }}>{what}</Box>
              <Box component="dd" sx={{ m: 0 }}>{from}</Box>
            </Box>
          ))}
        </Box>
        <Typography variant="body2" sx={{ mt: 1.5, color: 'text.secondary' }}>
          Not affiliated with or endorsed by NZTA or MetService.
        </Typography>

        <Heading>Your settings</Heading>
        <Typography variant="body2">
          What you choose (the map’s view and layers, pinned cameras, the theme) is kept only in this browser. There
          are no accounts and no tracking.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', pl: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Version {version} · <Out href={homepage}>Source code</Out> (GPL-2.0)
        </Typography>
        {!phone && <Button onClick={onClose}>Close</Button>}
      </DialogActions>
    </Dialog>
  );
}
