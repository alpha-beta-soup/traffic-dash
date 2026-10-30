# traffic-dash

A dashboard for New Zealand traffic cameras and congestion information.

A web app (React + MapLibre, built with Vite) with a small Node/Express server. The server proxies the NZTA traffic feeds, which can't be called from a browser because they send no CORS headers. It also keeps API keys out of the browser and caches recent camera frames on disk so a camera's last few hours can be animated.

## Running

Requires Node 22+.

```sh
cp .env.template .env   # optional: fill in keys
npm install
npm run dev             # server on :3000, Vite dev server on :5173 (proxies /api to the server)
```

For production: `npm run build && npm start`, then open http://localhost:3000.

All keys are optional. Without them you still get cameras and variable message signs.

| Key | Meaning | Default |
|---|---|---|
| `OPENWEATHERMAP_APIKEY` | OpenWeatherMap API key: weather and sunrise/sunset per camera (free tier OK) | |
| `MAPBOX_TOKEN` | Mapbox token: live traffic lines on the map, per-camera congestion and the congestion filter, from Mapbox Traffic v1 vector tiles (proxied and cached by the server; free tier OK) | |
| `MAP_STYLE` | Base map style URL | OpenFreeMap Liberty (no key) |
| `PORT` | Server port | 3000 |
| `CACHE_ENABLED` | Cache camera frames to `cache/` for animation | true |
| `CACHE_MAX_AGE_HOURS` | Frames older than this are pruned | 6 |
| `VITE_MIN_REFRESH` / `VITE_MAX_REFRESH` | Each camera refreshes at a random interval in this range (ms) | 10000 / 25000 |

Camera and sign data come from the public [trafficnz.info REST API](https://trafficnz.info/service/traffic/rest/4/cameras/all), which replaced the old credentialed InfoConnect API.

Camera images and sign data: © Waka Kotahi NZ Transport Agency. The [NZTA terms of use](https://www.journeys.nzta.govt.nz/about-this-site/terms-of-use) allow reproduction for personal use with attribution. Contact informationteam@nzta.govt.nz before any other use, such as public hosting. This project is not affiliated with or endorsed by NZTA.

## Thanks to

- [NZTA traffic information (trafficnz.info)](https://trafficnz.info/)
- [Mapbox Traffic v1](https://docs.mapbox.com/data/tilesets/reference/mapbox-traffic-v1/)
- [OpenFreeMap](https://openfreemap.org/) and [MapLibre GL JS](https://maplibre.org/)
- [OpenWeatherMap](https://openweathermap.org/)
- [Weather Icons](https://erikflowers.github.io/weather-icons/)

## Research & Prior Art

- https://www.nzta.govt.nz/media-releases/wellington-traffic-operations-centre-opens-in-time-for-easter/
- http://www.reaaa.co.nz/publication/nzta-traffic-operations-business-%E2%80%93-des-o%E2%80%99sullivan-nzta/wppa_open/
- https://www.stuff.co.nz/national/99897853/curious-city-the-team-that-keep-new-zealands-traffic-moving

## Blog

https://spatialparalysis.xyz/blog/traffic-dashboard/
