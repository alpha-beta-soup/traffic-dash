# traffic-dash

A dashboard for New Zealand traffic cameras and congestion information.

An Electron application, so it should run on any platform. However this has been developed solely on Linux, so no guarantees.

**In development.**

## Running for development

You will need to create a file at the project root, called `.env`. This needs to contain a series of variables. First `cp .env.template .env` and then fill in the variables as follows:

| Key                     	| Meaning                                                                                                                                                                                                     	| Default 	|
|-------------------------	|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------	|---------	|
| `MAPBOX_TOKEN`          	| Mapbox API key (used for vector tile requests, and for vector tile query requests; free tier OK)                                                                                                            	|         	|
| `INFOCONNECT_USER`      	| NZTA InfoConnect API username (used to get camera and signs data; free)                                                                                                                                     	|         	|
| `INFOCONNECT_PW`        	| NZTA InfoConnect API password (used to get camera and signs data; free)                                                                                                                                     	|         	|
| `GOOGLE_APIKEY`         	| Google API key (for [geolocation](https://developers.google.com/maps/documentation/geolocation/intro), only used once on load; free tier OK)                                                                                                                                      	|         	|
| `OPENWEATHERMAP_APIKEY` 	| OpenWeatherMap API key (used to get weather data, and surise/sunset times for each camera; free tier OK)                                                                                                    	|         	|
| `MIN_REFRESH`           	| Cameras are refreshed every `MIN_REFRSH` milliseconds at a minimum.                                                                                                                                         	| 10000   	|
| `MAX_REFRESH`           	| Cameras are refreshed every `MAX_REFRESH` milliseconds at a maximum.                                                                                                                                        	| 25000   	|
| `MIN_TRAFFIC_REFRESH`   	| Congestion data are refreshed every `MIN_TRAFFIC_REFRESH` milliseconds at a minimum. This data does not change rapidly, so don't set this very low or you will simply exceed your Mapbox API request limit. 	| 150000  	|
| `MAX_TRAFFIC_REFRESH`   	| Congestion data are refreshed every `MAX_TRAFFIC_REFRESH` milliseconds at a maximum.                                                                                                                        	| 300000  	|

`npm i && npm run dev`

This will run with a **persistent** local camera cache. (So it will eventually fill your system.) A temporary and/or remote cache is a useful feature, it just doesn't exist as an option yet.

## Thanks to

- [NZTA Traffic Camera API](https://www.nzta.govt.nz/traffic-and-travel-information/infoconnect-section-page/about-the-apis/traffic-cameras/)
- [NZTA Variable Message Signs API](https://www.nzta.govt.nz/traffic-and-travel-information/infoconnect-section-page/about-the-apis/auckland-traffic-api/)
- [Mapbox Traffic v1](https://www.mapbox.com/vector-tiles/mapbox-traffic-v1/)
- [OpenWeatherMap](https://openweathermap.org/)
- [Google Maps Geolocation API](https://developers.google.com/maps/documentation/geolocation/intro)

Terms of the InfoConnect API: https://www.nzta.govt.nz/traffic-and-travel-information/infoconnect-section-page/terms-of-use/

## Research & Prior Art

- https://www.nzta.govt.nz/media-releases/wellington-traffic-operations-centre-opens-in-time-for-easter/
- http://www.reaaa.co.nz/publication/nzta-traffic-operations-business-%E2%80%93-des-o%E2%80%99sullivan-nzta/wppa_open/
- https://www.stuff.co.nz/national/99897853/curious-city-the-team-that-keep-new-zealands-traffic-moving

## Blog

http://www.nearimprov.com/traffic-dashboard/
