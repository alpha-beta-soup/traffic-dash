# Vehicle count evaluation

An offline check of how well a pretrained object detector counts vehicles in the camera
frames, before building anything into the app. It runs over frames already in `cache/` (so run
the app for a while first, ideally across day and night), and writes annotated copies and a
contact sheet to `eval-output/vehicles/`.

## Setup

1. Dependencies (the server uses them too, to count vehicles): `npm i onnxruntime-node sharp`
2. The model, [D-FINE small](https://huggingface.co/ustc-community/dfine-small-coco) (Apache-2.0,
   trained on COCO), as exported to ONNX by onnx-community (41.5 MB):

   ```sh
   mkdir -p models
   curl -L -o models/dfine_s_coco.onnx \
     https://huggingface.co/onnx-community/dfine_s_coco-ONNX/resolve/main/onnx/model.onnx
   ```

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
- `--model`: another detector with the same inputs and outputs, e.g. RT-DETRv2
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

