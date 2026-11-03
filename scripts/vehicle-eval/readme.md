# Vehicle count evaluation

An offline check of how well a pretrained object detector counts vehicles in the camera
frames, before building anything into the app. It runs over frames already in `cache/` (so run
the app for a while first, ideally across day and night), and writes annotated copies and a
contact sheet to `eval-output/vehicles/`.

## Setup

1. Dependencies (the server uses them too, to count vehicles): `npm i onnxruntime-node sharp`
2. The models, [D-FINE](https://github.com/Peterande/D-FINE) (Apache-2.0) as exported to ONNX by
   onnx-community: medium, trained on Objects365 then COCO (78.6 MB; the default), and small,
   trained on COCO (41.5 MB; cheaper). `VEHICLE_MODEL` picks one, and `--model` here.

   ```sh
   mkdir -p models
   curl -L -o models/dfine_m_obj2coco.onnx \
     https://huggingface.co/onnx-community/dfine_m_obj2coco-ONNX/resolve/main/onnx/model.onnx
   curl -L -o models/dfine_s_coco.onnx \
     https://huggingface.co/onnx-community/dfine_s_coco-ONNX/resolve/main/onnx/model.onnx
   ```

   On the same frames, medium found about 5% more vehicles: fewer that weren't (arrows painted on
   the road, signs, the camera's logo) and more that were, far off and at night, where small saw
   only headlights. It takes about 1.75 times as long.

`models/` and `eval-output/` are ignored by git.

## Running

```sh
npm run eval:vehicles
npm run eval:vehicles -- --cameras 60 --threshold 0.5 --sequence 282
```

- `--cameras`: how many cameras to take their latest frame from, spread across image sizes (40)
- `--sequence`: a camera to take its last 10 frames from, to see how steady the count is (228)
- `--threshold`: the detection score counted as a vehicle (0.4); counts at 0.3, 0.4 and 0.5
  are listed for each frame
- `--model`: `medium` (the default) or `small`, or another detector with the same inputs and outputs, e.g. RT-DETRv2
  (`onnx-community/rtdetr_v2_r18vd-ONNX`)

Open `eval-output/vehicles/index.html` to look through the frames with their boxes: green cars,
yellow motorcycles, blue buses, orange trucks.

## Trends

```sh
npm run eval:trends
npm run eval:trends -- --cameras 10 --window 15
```

Counts every cached frame of the cameras with the most history and charts each one: the counts
as faint dots, a rolling mean over a centred window (`--window`, minutes, 10), and a 95% band
for that mean from the window's own spread (`src/utils/trend.js`). Counts vary a lot frame to
frame (traffic bunches; one frame a minute samples it at random), so the trend and its band,
not any one count, are what to read. The line is only drawn where its window holds 4 or more
frames, and breaks across gaps (frames are only cached while someone views a camera).

Output: `eval-output/trends/index.html`; hover a chart for each frame's count and the trend.
Counts are kept in `counts.json` there, so reruns only count new frames.

`--tile 320` counts in overlapping tiles of about 320 px as well as the whole frame, which finds
about half as many vehicles again, mostly small ones in the mid-distance and in queues, at about
7 times the cost. `npm run eval:vehicles -- --tile 320` shows which boxes only the tiles found.

## Tiling only the far side

```sh
npm run eval:far
npm run eval:far -- --per-size 2 --frames 20
```

Tiles cost a pass of the model each, as much as the whole frame (a tile is enlarged to the
model's input), and large frames have many: a 1920×1080 frame is 24 tiles. Cameras look down the
road, so near vehicles are at the bottom, big enough to find in the whole frame. This looks at
frames from the cameras with the most history at each frame size, whole and in every tile, and
works out what only the top rows of tiles would have counted (the merge of just those passes).

Across 22 cameras one evening (3:40–9:40 pm, 220 frames), against all the tiles:

| Tiles | Vehicles | Time |
|---|---|---|
| None (whole frame only) | 72% | 12% |
| Top row | 95% | 50% |
| Top half of the rows | 96% | 62% |
| Top two-thirds | 100% | 95% |

The counter uses the top half. Frames 2 rows of tiles high (most of them) lose a little of what
the bottom row found, up to a fifth of what tiling adds at some cameras; large frames lose almost
nothing.

## Occupancy

```sh
npm run eval:occupancy
npm run eval:occupancy -- --cameras 6 --tile 0
```

A second measure of the traffic in view, for what detection misses: vehicles too small or too
bunched up to box, as in a far-off queue. Charted under the detected count, per camera, on the
same time axis:

1. **Baseline:** every 30 minutes, each pixel's median over the 9 emptiest frames (fewest
   vehicles detected) within 3 hours: the road without its traffic. Within 1 hour, a long queue
   ends up in the baseline itself.
2. **What differs:** frames are compared after taking off the change in light across the road
   (the median difference in 16 px cells, smoothed: shade and sun are broad, vehicles small and
   sharp), and allowing for the camera shaking a pixel. Without this, afternoon shade on the road
   counts as traffic.
3. **Perspective:** how big a car looks at each spot, from the cars detected there; each
   differing pixel adds 1 ÷ a car's area there, so a vehicle anywhere adds about 1
   (vehicle-equivalents).
4. **Road only:** where cars have been detected.

Output: `eval-output/occupancy/index.html`, with each camera's latest baseline and its busiest
frame showing what was counted. Detections are kept in `eval-output/detections-tile<px>.json`,
shared with `eval:road`.

**Not ready.** It counts real vehicles once the light is allowed for, but the far field, which is
what it's for, is where it falls down. A straight-line fit of car size by row (tried first) can
reach towards the horizon, but only suits a straight road: it broke on a curving road (Ngauranga
Gorge) and on several roads at different distances (Petone). Sizes from where cars were detected
suit any view, but stop where detection does. It would need both, and testing across days, dusk,
rain and night.

## Vehicles on the road

```sh
npm run eval:road
```

The detector finds parked cars too (yards, service lanes, the verge), the same ones in every
frame: a floor under the count that flattens its swing, and that empties as people drive home.
This leaves out vehicles with a box in the same place in most frames within 15 minutes either
side (queued traffic creeps along between frames a minute apart, so stays), and any with their
wheels off the road (where moving vehicles have been).

On SH1/SH2 Interchange, a quarter of detections were parked cars on a service lane; without them
the evening rise went from about 15% to 65%, peaking at 4:30–5 rather than 3. Cameras without
parking in view were unchanged. The road area left out almost nothing: over hours, moving
vehicles go nearly everywhere a vehicle can.

Output: `eval-output/road/index.html`, with each camera's road and parked vehicles.

