#!/usr/bin/env python3
"""MDining pilot: custom segmentation -> plate crossing -> calibrated waste.
See README.md before interpreting percentages. No trained weights are bundled.
"""
import argparse
import csv
import json
import math
import time
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


def summarize(events, servings, foods):
    totals = defaultdict(float)
    for row in events:
        totals[row['item']] += float(row['estimated_waste_g'])
    output = []
    for item, spec in foods.items():
        count = servings.get(item, 0)
        grams = totals[item]
        denominator = count * spec['serving_g']
        pct = 100 * grams / denominator if denominator else None
        output.append(dict(item=item, servings=count, estimated_waste_g=round(grams, 2),
                           estimated_waste_g_per_serving=round(grams / count, 2) if count else None,
                           estimated_waste_percent=round(pct, 2) if pct is not None else None,
                           status='missing_servings' if not count else
                           'check_calibration_or_counts' if pct > 100 else 'estimate'))
    return sorted(output, key=lambda r: r['estimated_waste_percent'] if r['estimated_waste_percent'] is not None else -1, reverse=True)


def read_servings(path, foods):
    counts = {}
    with open(path, newline='') as f:
        for row in csv.DictReader(f):
            item, n = row['item'], int(row['servings'])
            if item not in foods or item in counts or n < 0:
                raise ValueError('Invalid, duplicate, or unconfigured serving item: ' + item)
            counts[item] = n
    return counts


class Tracker:
    """Simple nearest-centroid association for spaced, one-direction plates."""
    def __init__(self, distance, ttl):
        self.distance, self.ttl = distance, ttl
        self.tracks, self.next_id = {}, 1

    def update(self, observations, now):
        self.tracks = {k: v for k, v in self.tracks.items() if now - v['seen'] <= self.ttl}
        pairs = sorted((math.dist(t['center'], o['center']), tid, i)
                       for tid, t in self.tracks.items() for i, o in enumerate(observations))
        assigned, used, matches = set(), set(), {}
        for d, tid, i in pairs:
            if d <= self.distance and tid not in assigned and i not in used:
                assigned.add(tid); used.add(i); matches[i] = tid
        result = []
        for i, o in enumerate(observations):
            tid = matches.get(i)
            if tid is None:
                tid = self.next_id; self.next_id += 1
                self.tracks[tid] = dict(center=o['center'], seen=now, armed=False, counted=False)
            t = self.tracks[tid]
            t.update(center=o['center'], seen=now)
            result.append((tid, t, o))
        return result


def observations(result, foods, plate_class, shape, roi):
    import cv2
    import numpy as np
    if result.masks is None or result.boxes is None:
        return []
    h, w = shape[:2]
    masks = []
    # masks.xy is returned in original image coordinates.
    for polygon, box in zip(result.masks.xy, result.boxes):
        mask = np.zeros((h, w), np.uint8)
        cv2.fillPoly(mask, [np.rint(polygon).astype(np.int32)], 1)
        name = result.names[int(box.cls.item())]
        masks.append((name, mask, box.xyxy[0].cpu().numpy()))
    plates = []
    x0, y0, x1, y1 = roi
    for name, mask, box in masks:
        if name != plate_class:
            continue
        x, y, xx, yy = box
        cx, cy = (x + xx) / 2, (y + yy) / 2
        # Require the entire plate bounding box inside the measurement ROI.
        if not (x >= x0*w and xx <= x1*w and y >= y0*h and yy <= y1*h):
            continue
        area = int(mask.sum())
        if area:
            plates.append(dict(center=(cx/w, cy/h), mask=mask, area=area, food_masks={}))
    for name, mask, _ in masks:
        if name not in foods or not plates:
            continue
        overlaps = [int((mask & p['mask']).sum()) for p in plates]
        i = int(np.argmax(overlaps))
        if overlaps[i] < 0.5 * int(mask.sum()):
            continue
        p = plates[i]
        clipped = mask & p['mask']
        p['food_masks'][name] = p['food_masks'].get(name, np.zeros_like(mask)) | clipped
    for p in plates:
        p['fractions'] = {name: float(mask.sum()) / p['area'] for name, mask in p['food_masks'].items()}
    return plates


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--config', default='config.json')
    ap.add_argument('--servings', default='servings.csv')
    ap.add_argument('--output', default='runs')
    ap.add_argument('--headless', action='store_true')
    ap.add_argument('--report-only', help='Recompute a run summary from its events.csv')
    a = ap.parse_args()
    cfg = json.loads(Path(a.config).read_text())
    foods = cfg['foods']
    for item, spec in foods.items():
        if spec['serving_g'] <= 0:
            raise ValueError('serving_g must be positive: ' + item)
    counts = read_servings(a.servings, foods)
    if a.report_only:
        with open(a.report_only, newline='') as f:
            rows = list(csv.DictReader(f))
        print(json.dumps(summarize(rows, counts, foods), indent=2))
        return
    for item, spec in foods.items():
        value = spec.get('grams_per_plate_fraction')
        if value is None or value <= 0:
            raise ValueError('Supply measured grams_per_plate_fraction for ' + item)
    import cv2
    from ultralytics import YOLO
    if not Path(cfg['model']).is_file():
        raise FileNotFoundError('Provide your trained segmentation weights: ' + cfg['model'])
    model = YOLO(cfg['model'])
    names = set(model.names.values())
    if model.task != 'segment' or not ({cfg['plate_class']} | set(foods)).issubset(names):
        raise ValueError('Segmentation model must contain plate and every configured food class')
    axis = cfg.get('axis', 'y')
    direction = cfg.get('direction', 1)
    line = cfg.get('count_line', 0.5)
    roi = cfg.get('roi', [0, 0, 1, 1])
    if axis not in ('x', 'y') or direction not in (-1, 1) or not 0 < line < 1:
        raise ValueError('Invalid axis/direction/count_line')
    if not (0 <= roi[0] < roi[2] <= 1 and 0 <= roi[1] < roi[3] <= 1):
        raise ValueError('Invalid normalized ROI')
    run = Path(a.output) / (datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '_' + uuid.uuid4().hex[:6])
    run.mkdir(parents=True)
    # Persist measurement provenance without copying a potentially credential-bearing stream URL.
    provenance = {k: v for k, v in cfg.items() if k != 'stream'}
    (run / 'measurement_config.json').write_text(json.dumps(provenance, indent=2))
    (run / 'serving_counts.json').write_text(json.dumps(counts, indent=2))
    events, plate_count = [], 0
    tracker = Tracker(cfg.get('match_distance', 0.12), cfg.get('track_ttl_s', 1.0))
    stream = cfg['stream']
    source = int(stream) if isinstance(stream, str) and stream.isdigit() else stream
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise RuntimeError('Cannot open stream. Check DroidCam URL, WiFi, and video format.')
    fields = ['timestamp_utc', 'plate_id', 'item', 'plate_area_fraction', 'estimated_waste_g']
    last_print = 0
    try:
        with open(run / 'events.csv', 'w', newline='') as f, open(run / 'plates.csv', 'w', newline='') as pf:
            writer = csv.DictWriter(f, fieldnames=fields); writer.writeheader()
            pw = csv.writer(pf); pw.writerow(['timestamp_utc', 'plate_id', 'recognized_food_items'])
            while True:
                ok, frame = cap.read()
                if not ok:
                    print('Stream ended or disconnected; saved run. Restart for a new run.')
                    break
                now = time.monotonic()
                result = model.predict(frame, conf=cfg.get('confidence', 0.5), verbose=False)[0]
                obs = observations(result, foods, cfg['plate_class'], frame.shape, roi)
                for tid, t, o in tracker.update(obs, now):
                    position = o['center'][0 if axis == 'x' else 1]
                    signed = direction * (position - line)
                    if signed < -cfg.get('arming_margin', 0.03):
                        t['armed'] = True
                    if t['armed'] and not t['counted'] and signed >= 0:
                        t['counted'] = True; plate_count += 1
                        stamp = datetime.now(timezone.utc).isoformat()
                        pw.writerow([stamp, tid, ';'.join(sorted(o['fractions']))]); pf.flush()
                        for item, fraction in o['fractions'].items():
                            row = dict(timestamp_utc=stamp, plate_id=tid, item=item,
                                       plate_area_fraction=round(fraction, 6),
                                       estimated_waste_g=round(fraction * foods[item]['grams_per_plate_fraction'], 3))
                            writer.writerow(row); events.append(row)
                        f.flush()
                if now - last_print >= 10:
                    report = summarize(events, counts, foods)
                    (run / 'summary.json').write_text(json.dumps(report, indent=2))
                    print('Plates counted:', plate_count, '\n' + json.dumps(report, indent=2))
                    last_print = now
                if not a.headless:
                    display = result.plot()
                    h, w = display.shape[:2]
                    cv2.rectangle(display, (int(roi[0]*w), int(roi[1]*h)), (int(roi[2]*w), int(roi[3]*h)), (255, 255, 0), 2)
                    p = int(line * (w if axis == 'x' else h))
                    cv2.line(display, (p, 0) if axis == 'x' else (0, p), (p, h) if axis == 'x' else (w, p), (0, 255, 0), 2)
                    cv2.imshow('MDining estimated waste - Q to stop', display)
                    if cv2.waitKey(1) & 0xff == ord('q'):
                        break
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        if not a.headless:
            cv2.destroyAllWindows()
        report = summarize(events, counts, foods)
        (run / 'summary.json').write_text(json.dumps(report, indent=2))
        with open(run / 'summary.csv', 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=list(report[0]) if report else ['item'])
            writer.writeheader(); writer.writerows(report)
        print('Saved:', run.resolve())


if __name__ == '__main__':
    main()
