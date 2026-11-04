# traffic-dash

A dashboard for New Zealand traffic cameras, message signs and congestion.

![The dashboard: a map of Wellington with camera sites, message signs and congestion, above live camera cards](docs/screenshot.jpg)

A web app (React + MapLibre, built with Vite) with a small Node/Express server. The server proxies the NZTA traffic feeds, which can't be called from a browser because they send no CORS headers. It also keeps API keys out of the browser, shares upstream requests between viewers, and caches recent camera frames on disk so the cameras can be animated.

An optional second process, the vehicle counter (`counter/`), counts vehicles in the cached frames. It's heavy, steady work, so it runs apart from the server: the two share only files on disk, the frames in `cache/` and the counts in `vehicle-counts/`.

## Running

Requires Node 24+ (and npm 11, which comes with it).

```sh
cp .env.template .env   # optional: fill in keys
npm install
npm run dev             # server on :3000, vehicle counter, Vite dev server on :5173 (proxies /api to the server)
```

For production: `npm run build && npm start`, then open http://localhost:3000; and, for vehicle counts, `npm run counter` beside it, in the same folder (or with the same `cache/` and `vehicle-counts/`). Without the counter, or without its model, the app works as before, without vehicle counts.

Other scripts: `npm test` (Node's built-in test runner; no extra dependencies) and `npm run lint`.

All keys are optional. Without them you still get cameras and variable message signs.

| Key | Meaning | Default |
|---|---|---|
| `OPENWEATHERMAP_APIKEY` | OpenWeatherMap API key: weather and sunrise/sunset per camera, and the rain layer (free tier OK) | |
| `MAPBOX_TOKEN` | Mapbox token: live traffic lines on the map, per-camera congestion and the congestion filter, from Mapbox Traffic v1 vector tiles (proxied and cached by the server; free tier OK) | |
| `MAP_STYLE` | Base map style URL | OpenFreeMap Liberty (no key) |
| `MAP_STYLE_DARK` | Base map style URL for the dark theme | `MAP_STYLE`, darkened by the server, so both themes are the same map |
| `PORT` | Server port | 3000 |
| `CACHE_ENABLED` | Cache camera frames to `cache/` for animation | true |
| `CACHE_MAX_AGE_HOURS` | Frames older than this are pruned | 6 |
| `VEHICLE_MODEL` | The vehicle detector: `medium` (more accurate), `small` (cheaper), or the path to another ONNX detector; vehicle counting is on when its file is in `models/`. See [scripts/vehicle-eval](scripts/vehicle-eval/readme.md) for where to get them. Counts from different models don't compare, so changing it puts a step in the charts | `medium` |
| `VEHICLE_COUNTS_DAYS` | Vehicle counts are kept this long, in `vehicle-counts/` | 7 |
| `VEHICLE_THREADS` | Threads the vehicle counter's model runs on; match it to the CPU the counter is given | one per core |
| `VEHICLE_MAX_MEMORY_MB` | Past this much memory, the vehicle counter saves its counts and exits, to be started afresh (Docker restarts it; Compose sets 2048). It logs its memory hourly either way | off |
| `TRUST_PROXY` | Behind a reverse proxy, how many hops of `X-Forwarded-For` to trust, so clients are rate limited by their own address | off |
| `DOMAIN` | For deploying with Docker Compose: the domain Caddy gets an HTTPS certificate for | `localhost` |
| `VITE_MIN_REFRESH` / `VITE_MAX_REFRESH` | Each camera refreshes at a random interval in this range (ms) | 10000 / 25000 |

### Dev server quirk

Occasionally a file change isn't picked up by the dev server (`node --watch` for the server, or Vite for the client), and it keeps serving the old code; the symptom is a change that has no effect, or a blank page after an edit. Restart `npm run dev`, or save the file again.

## Deploying

`docker-compose.yml` runs it on one machine: the server, the vehicle counter beside it (sharing the frames and counts through volumes, capped at 2 CPUs so it never starves the server), and [Caddy](https://caddyserver.com/) in front for HTTPS. A small VPS near New Zealand with 2–4 cores and Docker is plenty.

1. Point your domain's DNS at the machine, and open ports 80 and 443.
2. `git clone` this repo there, then `cp .env.template .env` and set `DOMAIN` and any keys.
3. For vehicle counts, put the model in `models/` (see [scripts/vehicle-eval](scripts/vehicle-eval/readme.md)); without it, the counter idles.
4. `docker compose up -d --build`

To update: `git pull && docker compose up -d --build`. Logs: `docker compose logs -f server counter`. Health: `/api/health`.

What the server does to stay a good neighbour when public:

- **Rate limit:** each client gets a burst of 300 requests to `/api`, then 10 a second; more get `429` with `Retry-After`. Behind Caddy, `TRUST_PROXY=1` (set in the compose file) makes that per client rather than for everyone at once.
- **Only New Zealand:** weather, and weather and traffic tiles, are relayed only for New Zealand, so the server's OpenWeatherMap and Mapbox keys can't be used for anywhere else. Weather is shared between viewers of the same place for 10 minutes.
- **Errors:** in production (`NODE_ENV=production`, as in the image), the browser is told only that a request failed; the detail is logged.
- **Content Security Policy:** the page may load only its own files, data from the map style's host and Open-Meteo, and nothing may frame it. A `MAP_STYLE` whose tiles or fonts come from another host needs that host added in `server/index.js`.
- **Caching:** the built app's files are named by their content, so browsers keep them for good; the page itself is checked each time, so a new version shows up straight away.

## Using it

- **Map:** camera sites are circles with a quarter per direction the site has a camera for: filled when working, grey when offline. Hover a site for its cameras' recent footage, and to highlight the road segments its congestion came from; click it to pin its cameras.
- **Cards:** any pinned cameras, then every camera in view, working ones first. A card only fetches its image, loop and counts while it's on screen (or nearly), so any number can be in view. Each loops the last 30 minutes, in sync with every other card. The coloured border is the congestion on the road the camera looks along.
- **Camera pages:** click a card's image for the camera's own page (`/camera/<id>`): the whole frame at full size, playback you control (Live, play/pause, step, and a scrubber across the saved history; space and the arrow keys work too), click-to-zoom on high-resolution cameras, its details, a small map of the cameras and signs around it (click a site to go there), the nearest lit message signs as their LED boards, nearby road events, and getting around: the site's other cameras, the nearest cameras on any road, the next camera either way along the state highway, and every camera on the route. Share copies the page's link; Back returns to the dashboard where you left it, or, if you've moved on from the first camera, centred where you ended up. Moving between cameras updates the page in place: the map pans to the next camera.
- **Congestion filter** (top bar): show only cameras at moderate or heavy congestion and worse.
- **Message signs:** small icons that expand into the sign on hover; shown in full from zoom 14.
- **Layers** (on the map): cameras and their labels, message signs, road events, weather warnings, rain, wind, traffic counts and congestion lines on or off. Rain, wind and traffic counts are off to start with. Camera icons shrink to half size as you zoom out to the whole country, so they don't bury the map. Rain is OpenWeatherMap's modelled precipitation, not radar; water on the base map is grey, so its blues stand out. Wind is Open-Meteo's forecast from ECMWF's global model, for the current hour, as faint wind barbs (into the wind; a half feather 5 knots, a full one 10, a pennant 50), the same size on screen at any zoom, and in the warning colour from 50 km/h.
- **Minimise:** shrinks the map to a card, keeping the area in view.
- **Theme** (top bar): Auto follows your system's light or dark setting; or pick Light or Dark.
- **Road events:** crashes, closures, roadworks and hazards, as NZ-road-sign-style icons; hover one for details. Cameras within 500m of a closure or delay are flagged on their cards.
- **Vehicles in view** (with the detector model): each frame the server saves is counted for cars, motorcycles, buses and trucks on the move: parked ones (in the same place for most of 15 minutes) are left out. Camera pages chart the last 3 hours: each frame's count, the average over 10 minutes, and its 95% band; cards show the last 30 minutes as a sparkline. Counts vary a lot frame to frame, as traffic bunches, so the trend is what to read; far-off and hidden vehicles are missed, so read it against the camera's own level, not as an exact number.
- **Traffic counts:** NZTA's state highway counting sites with recent counts (about 470), each place (a road's directions, an interchange's ramps; zoomed in, each site on its own) a rounded square, unlike the round camera icons, sized by its traffic and coloured by how its latest week compares with the same week of recent years (the last three, averaged, so one odd year counts for less): blue and − quieter, magenta and + busier, grey within 10%. Zoomed in, a busier or quieter place is labelled with its change (+12%). Hover one for its last five weeks against recent years; the key says how up to date the counts are, and clicking its colours shows or hides them (to see only the busier roads, say). It can compare all vehicles, or only heavy (trucks and buses) or light ones, as NZTA counts them by length: a freight detour shows up as heavy vehicles much busier while all traffic barely changes. A class is compared only where it averaged 40 or more a day in recent years. Camera pages within 1 km of a counting site show its counts too, beside the vehicles in view. The counts arrive weekly or so, so they're days old: they show a road that's been busier or quieter for a while (a detour, a closure), not what's happening now. Recent years, rather than the weeks before, so a long disruption never comes to look normal. Public holidays (national, and each region's anniversary day) are shaded on the charts and left out of the comparison, as some move from year to year: Easter would otherwise make one week look much quieter than recent years, and another much busier.
- **Weather warnings:** MetService's current watches and warnings, as areas tinted in their colour (yellow, orange or red); click inside one for its details. Cameras inside a warning are flagged on their cards and show it on their pages.

Settings (pins, filter, layers, looping, theme) and the map's position are remembered in the browser.

## How it works

- **Cameras and signs** come from the public [trafficnz.info REST API](https://trafficnz.info/service/traffic/rest/4/cameras/all), which replaced the old credentialed InfoConnect API. The server shares the lists between viewers for a minute, and each camera's image for 10 seconds.
- **Unavailable cameras:** NZTA sometimes serves a stock "This webcam is temporarily unavailable" image before marking a camera offline. The server recognises it (by its hash, or by the same image coming from several cameras), reports the camera as unavailable, and never caches it as a frame.
- **Animation:** frames are cached only while someone is viewing a camera, so a loop can be shorter than 30 minutes.
- **Vehicle counting** runs in its own process (`counter/`), so it never slows the server, and can be given its own CPU or machine. It looks for new frames in `cache/` every 5 seconds, writes counts to `vehicle-counts/`, and a heartbeat there that tells the server it's running. It runs D-FINE (Apache-2.0; medium, trained on Objects365 then COCO, or small, on COCO) through onnxruntime, looking at each frame whole and in overlapping tiles of about 320 px across its top half (the far side of the road), which finds about half as many vehicles again (mostly small, far-off ones): several seconds of CPU a frame with medium, more for large frames, and about 60% of that with small. Medium finds fewer things that aren't vehicles (arrows painted on the road, signs, the camera's logo) and more that are, far off and at night. Frames are counted one at a time, new ones first, then any cached before a restart. Parked vehicles are left out because they'd be a floor under the count, flattening its rises and falls; at one camera they were a quarter of what was detected. Like the frames, counts exist only for cameras someone has viewed.
- **Out of date:** if message signs, road events, weather warnings or traffic counts can't be refreshed (or are well overdue), a line under the title says which, and when each last loaded; what was loaded before stays on show meanwhile.
- **Restarts:** the traffic counts take half a minute or more to fetch from NZTA, so the server keeps its last copy in `server-state/` (a volume in Docker) and serves it straight after a restart, refreshing it in the background once it's over 6 hours old.
- **Cross-origin isolation:** the server (and Vite) send `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless`, so the wind layer can share its weather data with its workers instead of copying it for every tile. Anything embedded from another site must allow CORS.
- **Congestion** is read from Mapbox Traffic v1 tiles in the browser: each camera is matched to segments within 200m, heading the way it looks, on the most important road nearby. NZTA's camera direction is sometimes a route label rather than a compass bearing (e.g. SH16 "Northbound" heading west); then roads in both directions are used. Streets and service lanes are never used.

Camera images and sign data: © Waka Kotahi NZ Transport Agency. The [NZTA terms of use](https://www.journeys.nzta.govt.nz/about-this-site/terms-of-use) allow reproduction for personal use with attribution. Contact informationteam@nzta.govt.nz before any other use, such as public hosting. This project is not affiliated with or endorsed by NZTA.

Traffic counts: Waka Kotahi NZ Transport Agency's [open data](https://opendata-nzta.opendata.arcgis.com/) (TMS daily traffic counts), licensed [Creative Commons BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Weather warnings: © MetService, licensed [Creative Commons BY 4.0](https://creativecommons.org/licenses/by/4.0/). This project is not affiliated with or endorsed by MetService.

## Licence

MIT (see [license.md](license.md)). The app as built includes Open-Meteo's weather map layer (GPL-2.0), so the app as a whole is distributed under GPL-2.0, with its source here; the version number in the app links to it.

## Thanks to

- [NZTA traffic information (trafficnz.info)](https://trafficnz.info/)
- [Mapbox Traffic v1](https://docs.mapbox.com/data/tilesets/reference/mapbox-traffic-v1/)
- [OpenFreeMap](https://openfreemap.org/) and [MapLibre GL JS](https://maplibre.org/)
- [OpenWeatherMap](https://openweathermap.org/)
- [Open-Meteo](https://open-meteo.com/) and its [weather map layer](https://github.com/open-meteo/weather-map-layer) (GPL-2.0), for the wind layer: data CC BY 4.0
- [D-FINE](https://github.com/Peterande/D-FINE) (Apache-2.0), via onnx-community ([medium](https://huggingface.co/onnx-community/dfine_m_obj2coco-ONNX), [small](https://huggingface.co/onnx-community/dfine_s_coco-ONNX)) and [ONNX Runtime](https://onnxruntime.ai/), for counting vehicles
- [MetService severe weather warnings](https://www.metservice.com/warnings/home), from its public CAP feed (CC BY 4.0)
- [Weather Icons](https://erikflowers.github.io/weather-icons/)

## Research & Prior Art

- https://www.nzta.govt.nz/media-releases/wellington-traffic-operations-centre-opens-in-time-for-easter/
- http://www.reaaa.co.nz/publication/nzta-traffic-operations-business-%E2%80%93-des-o%E2%80%99sullivan-nzta/wppa_open/
- https://www.stuff.co.nz/national/99897853/curious-city-the-team-that-keep-new-zealands-traffic-moving

## Blog

https://spatialparalysis.xyz/blog/traffic-dashboard/
