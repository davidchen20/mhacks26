# MDining conveyor waste pilot

This is a configurable prototype, not a pretrained food-waste measurement system.
It reads an iPhone DroidCam feed, segments plates and food, counts plates crossing
one line, estimates leftover grams, and lists estimated waste percentages by item.
You must supply trained segmentation weights, measured calibration, and serving
counts. The included rice/chicken/broccoli menu and serving sizes are placeholders.
The program deliberately refuses to measure with missing calibration or weights.

## Install and run (Python 3.10 or newer)

Extract this folder, open a terminal in it, and run:

```bash
python -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows instead: .venv\Scripts\activate
pip install -r requirements.txt
python waste_monitor.py --config config.json --servings servings.csv
```

Keep DroidCam open on the iPhone and put the computer on the same reachable WiFi.
Replace `stream` with the direct video URL using the IP and port shown in the app,
usually `http://IP:PORT/video`. A browser control-page URL is not a video stream.
Some app versions use `http://IP:PORT/video/SIZE`; use the supported MJPEG URL for
your version. If direct streaming is unavailable, use the DroidCam desktop client
and set `stream` to your virtual camera's numeric index, e.g. `"0"`.
Try the feed in VLC first. Campus WiFi client isolation can block access.

Use Q to stop the preview or Ctrl+C. `--headless` disables the preview.
A disconnect ends the run and saves results; it does not silently reconnect,
since reconnecting could count plates again. No video or still images are saved.
Each invocation creates a new run folder; do not combine overlapping sessions.
Dependencies are bounded but not an exact tested lockfile; record installed
versions when validating a deployment.

## Required custom food recognition model

Use a YOLO instance-segmentation model trained on this conveyor and the current
menu. A generic pretrained model cannot identify all of your menu items. Train on
empty plates, partly eaten/mixed foods, varied portions, lighting, plate positions,
and distractors such as napkins and hands. Split validation by recording session,
not adjacent frames. Classes must exactly match `plate_class` and `foods` keys.

IMPORTANT: the `plate` mask must include the FULL plate silhouette, including
regions covered by food. Food masks are separate overlapping classes inside the
plate silhouette. A mask of visible ceramic only will discard food in this script.
Use an annotation/training pipeline supporting those overlapping instance masks.
Inspect predicted masks on held-out videos before deploying. Do not assume training
success from classification accuracy alone. Use one fixed plate size per calibration;
handle bowls or different plate sizes in separate calibrated runs.

One example Ultralytics training command, after creating a labeled segmentation dataset:

```bash
yolo segment train model=yolo11n-seg.pt data=menu_dataset.yaml epochs=100 imgsz=640
```

Set `model` to the resulting local `best.pt` path. Dataset YAML lists train/val
images and class names; labels use YOLO polygon segmentation format. Training data,
weights, and their validation cannot be supplied without images of your actual menu.

## Camera geometry and counting

Mount overhead, approximately perpendicular to the conveyor, with stable lighting,
focus, and exposure. Keep silverware, hands, and bin areas out of the measurement
ROI. Use spaced plates moving steadily in one direction. Entire plates must fit
within the ROI on both sides of the counting line. ROI coordinates and counting
line are fractions of frame width/height.

`axis: y, direction: 1` means top-to-bottom motion; `direction: -1` means the
reverse. For horizontal motion use `axis: x`. The green line is the counting line;
the blue rectangle is the ROI. A plate must first appear upstream of the line by
`arming_margin`, then cross it. Plates initially downstream are skipped. Food masks
are measured on the crossing frame; multiple masks of the same item are unioned.
A food mask is assigned to its most-overlapping plate only if at least half lies
inside that plate. Unrecognized food is omitted, NOT inferred to be eaten.

Centroid matching is intentionally simple. `match_distance` is in normalized frame
coordinates; `track_ttl_s` controls expiry. Touching/stacked plates, occlusions,
reversals, missed detections, slow inference, and an overly large matching distance
can cause missed or repeated counts. Validate against manually counted videos.
Process at sufficient frame rate so plates move less than the matching distance
between processed frames. This loop is a synchronous pilot, not a buffered
production capture pipeline; measure latency and throughput on your hardware.

## Calibrate grams, not just pixels

For each item, weigh multiple representative leftovers at different masses and
shapes. Image them using the SAME plate, camera, and counting-line position. From
the predicted masks calculate `f = food_mask_pixels / full_plate_mask_pixels`.
Fit a through-origin calibration across sample pairs `(f, weighed_grams)`:

    grams_per_plate_fraction = sum(f * weighed_grams) / sum(f * f)

Enter that value for each food. A toy calculation: 30 g of rice covering 0.10 of
the plate suggests a coefficient of 300 g per full-plate fraction. It is NOT a
recommended coefficient; use multiple weighed samples, and validate on different
held-out samples. `serving_g` is the measured typical ORIGINAL serving weight.

Area cannot recover thickness, stacked food, hidden leftovers, sauces, or mixed
items reliably. For irregular piles, a single linear coefficient may fail. Report
held-out per-item mass errors and compare aggregate estimates with sorted, weighed
waste before using operationally. If accuracy is inadequate, add a scale/depth
sensor or serving-side measurements rather than claiming precise percentages.

## Denominator and reports

Fill `servings.csv` with actual counts of portions dispensed for each item during
the EXACT observation window, including portions completely eaten. Multiple
portions count as multiple servings. Counts must cover the same dining operation
and return stream: if some patrons use other disposal routes, these estimates
understate total waste. The camera alone cannot supply these denominators.

For item i:

    leftover_g_on_plate = plate_area_fraction * grams_per_plate_fraction
    average_wasted_g_per_serving = total_leftover_g / servings_dispensed
    waste_percent = 100 * total_leftover_g / (servings_dispensed * serving_g)

This is an aggregate estimated mass waste percentage, not an individual diner's
fraction eaten and not the fraction of visible plate covered with food. It is
NOT the average among plates with visible leftovers. Percentages above 100 are
flagged, not clipped; missing/zero serving counts produce null percentages.

Each run has `events.csv` (recognized food on counted plates), `plates.csv`
(including plates with no recognized food), `summary.csv`, `summary.json`, and
configuration/count snapshots. Empty recognition does not prove an empty plate.
Summary rows are sorted by estimated waste percentage. Summaries update every
10 seconds; the final CSV writes on exit. To update provisional serving counts:

```bash
python waste_monitor.py --config config.json --servings servings.csv --report-only runs/RUN_NAME/events.csv > updated_summary.json
```

That command recomputes a report without camera, weights, or ML dependencies.
It uses the CURRENT config, so keep calibration/serving weight unchanged for the
same run. Use the run's measurement_config.json to reproduce its original calibration.

## Verification supplied

`python test_core.py` checks percentage denominators, absent servings, uncapped
percentages, and track identity/expiry with synthetic data. Live camera access,
trained model inference, and gram accuracy were not verified on your hardware.

References:
- https://droidcam.app/help/
- https://www.droidcam.app/obs/
- https://docs.ultralytics.com/tasks/segment/
- https://docs.ultralytics.com/datasets/segment/
