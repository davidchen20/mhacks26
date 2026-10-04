#!/usr/bin/env python3
"""Image-only food waste estimation (visible AREA, not grams).

Examples:
  python waste_monitor.py --csv detections.csv --reference-csv full_portions.csv
  python waste_monitor.py --images plate.jpg --food chips
  python waste_monitor.py --images before.jpg --food chips --set-reference --config geometry_config.json
  python waste_monitor.py --images leftover.jpg --food pizza --pizza-crust .123,.433,.550,.296
  python waste_monitor.py --source 'http://IP:PORT/video' --food chips

No scale, serving weight, density coefficient, trained YOLO model, or serving-count
file is required. Food identity is explicitly supplied: this is a geometry/color
prototype for one chosen food per plate, not a general mixed-food classifier.
The built-in chips reference is the user-approved IMG_7487 pile = 100%.
Cookie/pizza can use a full-portion photo; pizza also supports a preserved crust
chord and known original slice angle, and cookies three points on an intact rim.
See README.md for examples, supported camera setup, and limitations.
"""
import argparse
import copy
import csv
import json
import math
import random
import statistics
import time
from datetime import datetime, timezone
from pathlib import Path

# CSV mode requires only Python's standard library.
try:
    import cv2
    import numpy as np
    from PIL import Image, ImageOps
except ImportError:
    cv2 = np = Image = ImageOps = None

ALIASES = {
    'chips': 'doritos_nacho_cheese', 'doritos': 'doritos_nacho_cheese',
    'pizza': 'dominos_cheese_pizza_slice', 'cookie': 'costco_oatmeal_raisin_cookie',
}
DEFAULT_CONFIG = {
    'schema_version': 2,
    'method': 'visible-area-only',
    'max_image_side': 1000,
    'plate_saturation_max': 90,
    'plate_value_min': 90,
    'min_plate_frame_fraction': 0.04,
    'min_fragment_plate_fraction': 0.00004,
    'axis': 'y', 'direction': 1, 'count_line': 0.5,
    'arming_margin': 0.04, 'match_distance': 0.15, 'track_ttl_s': 1.5,
    'foods': {
        'doritos_nacho_cheese': {
            'display_name': 'Nacho Cheese Doritos',
            'hsv_lower': [0, 95, 45], 'hsv_upper': [36, 255, 255],
            'reference_fraction': 0.2367595,  # Plate-normalized visible area of approved IMG_7487.
            'reference_description': 'IMG_7487(1).jpg pile = one user-defined full portion; stacked chips make this a visible-area proxy',
        },
        'dominos_cheese_pizza_slice': {
            'display_name': "Domino's cheese pizza slice",
            'hsv_lower': [0, 65, 35], 'hsv_upper': [40, 255, 255],
            'reference_fraction': None,
            'reference_description': 'Use a full-slice photo, or --pizza-crust endpoints on a fully preserved crust',
        },
        'costco_oatmeal_raisin_cookie': {
            'display_name': 'Costco oatmeal raisin cookie',
            'hsv_lower': [0, 65, 35], 'hsv_upper': [40, 255, 255],
            'reference_fraction': None,
            'reference_description': 'No cookie photo supplied; use a full-cookie reference or --cookie-rim',
        },
    },
}


def food_id(value):
    result = ALIASES.get(value, value)
    if result not in DEFAULT_CONFIG['foods']:
        raise ValueError('Choose chips, pizza, cookie, or a full configured item ID.')
    return result


def load_image(path, max_side=1000):
    if Path(path).suffix.lower() in ('.heic', '.heif'):
        try:
            import pillow_heif
            pillow_heif.register_heif_opener()
        except ImportError as exc:
            raise RuntimeError('For HEIC input, install pillow-heif or export the photo as JPEG.') from exc
    image = ImageOps.exif_transpose(Image.open(path)).convert('RGB')
    image.thumbnail((max_side, max_side))
    return cv2.cvtColor(np.asarray(image), cv2.COLOR_RGB2BGR)


def normalized_points(text, expected=None):
    values = [float(x) for x in text.split(',')]
    if len(values) % 2 or (expected is not None and len(values) != expected * 2):
        raise ValueError('Coordinates must be comma-separated x,y pairs in the range 0..1.')
    if not all(math.isfinite(x) and 0 <= x <= 1 for x in values):
        raise ValueError('Use normalized image coordinates between 0 and 1.')
    return np.array(values, np.float32).reshape(-1, 2)


def ellipse_area(ellipse):
    return math.pi * ellipse[1][0] * ellipse[1][1] / 4


def plate_coordinates(points, ellipse, shape):
    """Map an approximately circular plate's projected ellipse to a unit circle.
    This affine correction approximates modest camera tilt; not full perspective recovery.
    """
    h, w = shape[:2]
    points = np.asarray(points) * [w, h] - np.asarray(ellipse[0])
    angle = math.radians(ellipse[2])
    rotation = np.array([[math.cos(angle), -math.sin(angle)], [math.sin(angle), math.cos(angle)]])
    return (points @ rotation) / (np.asarray(ellipse[1]) / 2)


def pizza_reference_fraction(crust_points, ellipse, shape, angle_deg=45):
    """Reconstruct a circular pizza sector from its complete outer-crust chord."""
    if not 0 < angle_deg < 180:
        raise ValueError('Original slice angle must be between 0 and 180 degrees.')
    a, b = plate_coordinates(crust_points, ellipse, shape)
    chord = float(np.linalg.norm(a - b))
    if chord < 0.02:
        raise ValueError('Crust endpoints are too close.')
    angle = math.radians(angle_deg)
    radius = chord / (2 * math.sin(angle / 2))
    return (0.5 * angle * radius * radius) / math.pi


def cookie_reference_fraction(rim_points, ellipse, shape):
    """Original circular cookie area from three untouched rim points."""
    a, b, c = plate_coordinates(rim_points, ellipse, shape)
    matrix = 2 * np.array([b - a, c - a])
    if abs(np.linalg.det(matrix)) < 0.005:
        raise ValueError('Rim points are nearly collinear; choose points farther apart on the original curved edge.')
    center = np.linalg.solve(matrix, [np.dot(b, b) - np.dot(a, a), np.dot(c, c) - np.dot(a, a)])
    radius = float(np.linalg.norm(center - a))
    return radius * radius  # pi*r^2 / unit plate area pi


def detect_plates(frame, cfg):
    h, w = frame.shape[:2]
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    light = ((hsv[:, :, 1] < cfg['plate_saturation_max']) &
             (hsv[:, :, 2] > cfg['plate_value_min'])).astype(np.uint8) * 255
    size = max(3, int(min(h, w) * 0.02) | 1)
    light = cv2.morphologyEx(light, cv2.MORPH_CLOSE, np.ones((size, size), np.uint8))
    contours, _ = cv2.findContours(light, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    plates = []
    for contour in contours:
        if cv2.contourArea(contour) < cfg['min_plate_frame_fraction'] * h * w:
            continue
        pts = contour.reshape(-1, 2)
        # Do not fit the straight image crop boundary as if it were the plate rim.
        pts = pts[(pts[:, 0] > 3) & (pts[:, 0] < w - 4) & (pts[:, 1] > 3) & (pts[:, 1] < h - 4)]
        if len(pts) < 30:
            continue
        ellipse = cv2.fitEllipse(pts)
        center, axes, _ = ellipse
        area = ellipse_area(ellipse)
        if (min(axes) < 30 or max(axes) / min(axes) > 2.8 or area > 2.2 * h * w
                or not (0 <= center[0] < w and 0 <= center[1] < h)):
            continue
        norm = plate_coordinates(pts / [w, h], ellipse, frame.shape)
        residual = float(np.median(abs(np.linalg.norm(norm, axis=1) - 1)))
        if residual > 0.09:
            continue
        mask = np.zeros((h, w), np.uint8)
        cv2.ellipse(mask, ellipse, 255, -1)
        visible = min(1., np.count_nonzero(mask) / area)
        plates.append({'ellipse': ellipse, 'area': area, 'mask': mask,
                       'center': (center[0] / w, center[1] / h),
                       'visible_fraction': visible, 'rim_fit_residual': residual})
    return sorted(plates, key=lambda p: p['area'], reverse=True)


def polygon_mask(points, shape):
    mask = np.zeros(shape[:2], np.uint8)
    h, w = shape[:2]
    cv2.fillPoly(mask, [np.rint(np.asarray(points) * [w - 1, h - 1]).astype(np.int32)], 255)
    return mask


def segment_food(frame, plate, food, cfg, region=None, outline=None):
    if outline is not None:
        return cv2.bitwise_and(polygon_mask(outline, frame.shape), plate['mask'])
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, np.array(food['hsv_lower'], np.uint8), np.array(food['hsv_upper'], np.uint8))
    mask = cv2.bitwise_and(mask, plate['mask'])
    if region is not None:
        mask = cv2.bitwise_and(mask, polygon_mask(region, frame.shape))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask)
    clean = np.zeros_like(mask)
    threshold = max(3, cfg['min_fragment_plate_fraction'] * plate['area'])
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= threshold:
            clean[labels == i] = 255
    return cv2.bitwise_and(clean, plate['mask'])


def area_percentage(current_fraction, reference_fraction):
    if reference_fraction is None:
        return None
    if not math.isfinite(reference_fraction) or reference_fraction <= 0:
        raise ValueError('The full-portion reference area must be a positive finite number.')
    return 100 * current_fraction / reference_fraction


def measure(frame, plate, food_key, cfg, args):
    food = cfg['foods'][food_key]
    mask = segment_food(frame, plate, food, cfg, args.region, args.outline)
    fraction = np.count_nonzero(mask) / plate['area']
    reference = food.get('reference_fraction')
    basis = food['reference_description']
    flags = ['visible_area_proxy', 'operator_selected_food']
    if args.pizza_crust is not None:
        reference = pizza_reference_fraction(args.pizza_crust, plate['ellipse'], frame.shape, args.slice_angle)
        basis = f'Pizza sector from operator-marked intact crust; original slice angle {args.slice_angle:g} degrees'
        flags.append('assumes_entire_original_crust_is_preserved')
    elif args.cookie_rim is not None:
        reference = cookie_reference_fraction(args.cookie_rim, plate['ellipse'], frame.shape)
        basis = 'Original circle inferred from three operator-marked intact cookie rim points'
        flags.append('assumes_original_cookie_was_circular')
    percentage = area_percentage(fraction, reference)
    if plate['visible_fraction'] < 0.97:
        flags.append('plate_cropped_scale_is_extrapolated')
    if np.any(mask[:2]) or np.any(mask[-2:]) or np.any(mask[:, :2]) or np.any(mask[:, -2:]):
        flags.append('food_touches_image_edge_visible_area_is_incomplete')
    if percentage is None:
        flags.append('full_portion_reference_required')
    elif percentage > 100:
        flags.append('exceeds_reference_check_portion_size_overlap_and_mask')
    if np.count_nonzero(mask) == 0:
        flags.append('no_food_pixels_detected_not_proof_of_consumption')
    result = {'food': food_key, 'remaining_percent': round(percentage, 2) if percentage is not None else None,
              'food_plate_area_fraction': round(float(fraction), 7),
              'reference_plate_area_fraction': round(reference, 7) if reference else None,
              'plate_visible_fraction': round(plate['visible_fraction'], 3),
              'reference_basis': basis, 'flags': flags,
              'geometry_points': (args.pizza_crust if args.pizza_crust is not None else args.cookie_rim).tolist()
              if args.pizza_crust is not None or args.cookie_rim is not None else None}
    return result, mask


def draw_result(frame, plate, result, mask):
    overlay = frame.copy()
    overlay[mask > 0] = (0.55 * overlay[mask > 0] + 0.45 * np.array([0, 0, 255])).astype(np.uint8)
    cv2.ellipse(overlay, plate['ellipse'], (0, 200, 0), 2)
    for point in result.get('geometry_points') or []:
        cv2.circle(overlay, tuple(np.rint(np.array(point) * [frame.shape[1], frame.shape[0]]).astype(int)), 6, (255, 255, 0), -1)
    pct = result['remaining_percent']
    text = f'{pct:.1f}% visible area remaining' if pct is not None else 'Reference needed - no percentage'
    cv2.rectangle(overlay, (0, 0), (frame.shape[1], 70), (25, 25, 25), -1)
    cv2.putText(overlay, text, (10, 28), cv2.FONT_HERSHEY_SIMPLEX, .65, (255, 255, 255), 2)
    cv2.putText(overlay, 'Red = food mask; green = estimated plate rim', (10, 55), cv2.FONT_HERSHEY_SIMPLEX, .45, (255, 255, 255), 1)
    return overlay


class Tracker:
    def __init__(self, cfg):
        self.cfg, self.tracks, self.next_id = cfg, {}, 1

    def update(self, plates, now):
        self.tracks = {k: t for k, t in self.tracks.items() if now - t['seen'] <= self.cfg['track_ttl_s']}
        pairs = sorted((math.dist(t['center'], p['center']), tid, i)
                       for tid, t in self.tracks.items() for i, p in enumerate(plates))
        used_tracks, used_plates, matches = set(), set(), {}
        for distance, tid, i in pairs:
            if distance <= self.cfg['match_distance'] and tid not in used_tracks and i not in used_plates:
                used_tracks.add(tid); used_plates.add(i); matches[i] = tid
        result = []
        for i, plate in enumerate(plates):
            tid = matches.get(i)
            if tid is None:
                tid = self.next_id; self.next_id += 1
                self.tracks[tid] = {'armed': False, 'counted': False, 'samples': []}
            track = self.tracks[tid]
            track.update(center=plate['center'], seen=now)
            result.append((tid, track, plate))
        return result


def save_results(output, records):
    (output / 'results.json').write_text(json.dumps(records, indent=2) + '\n')
    with (output / 'results.csv').open('w', newline='') as f:
        fields = ['image', 'timestamp_utc', 'plate_id', 'food', 'remaining_percent',
                  'food_plate_area_fraction', 'reference_plate_area_fraction', 'plate_visible_fraction',
                  'reference_basis', 'flags']
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction='ignore')
        writer.writeheader()
        for record in records:
            writer.writerow({**record, 'flags': ';'.join(record.get('flags', []))})
    summary = []
    for key in sorted({r['food'] for r in records}):
        rows = [r for r in records if r['food'] == key and r.get('remaining_percent') is not None]
        summary.append({'food': key, 'measured_plate_observations': len(rows),
                        'mean_remaining_area_percent': statistics.mean(r['remaining_percent'] for r in rows) if rows else None,
                        'scope': 'Mean of observed plates, NOT percentage of all portions dispensed. Repeated photos of one plate are repeated observations.'})
    (output / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')


def read_config(path):
    cfg = copy.deepcopy(DEFAULT_CONFIG)
    if path and path.exists():
        supplied = json.loads(path.read_text())
        if supplied.get('schema_version') != 2:
            raise ValueError('Old mass-based config is incompatible. Generate a new geometry config with --init-config.')
        cfg.update(supplied)
    if cfg['axis'] not in ('x', 'y') or cfg['direction'] not in (-1, 1) or not 0 < cfg['count_line'] < 1:
        raise ValueError('Invalid stream counting axis/direction/line.')
    for key in DEFAULT_CONFIG['foods']:
        food = cfg['foods'][key]
        ref = food.get('reference_fraction')
        if ref is not None:
            area_percentage(0, ref)
    return cfg


CSV_COLUMNS = ('image', 'food', 'confidence', 'mask_fraction_of_image')


def csv_food_id(value):
    """Normalize labels; permit arbitrary foods with their own CSV reference."""
    key = '_'.join(value.strip().lower().replace('-', ' ').split())
    aliases = {
        'nacho_cheese_doritos': 'doritos_nacho_cheese',
        'dominos_cheese_pizza': 'dominos_cheese_pizza_slice',
        "domino's_cheese_pizza_slice": 'dominos_cheese_pizza_slice',
        'costco_cookie_oatmeal_raisin': 'costco_oatmeal_raisin_cookie',
    }
    return ALIASES.get(key, aliases.get(key, key))


def read_detection_csv(path):
    """Keep invalid rows for review instead of interpreting them as zero waste."""
    rows = []
    with Path(path).open(newline='', encoding='utf-8-sig') as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames or not set(CSV_COLUMNS).issubset(reader.fieldnames):
            raise ValueError(f'{path}: required CSV columns: {", ".join(CSV_COLUMNS)}')
        for line, row in enumerate(reader, 2):
            record = {column: (row.get(column) or '').strip() for column in CSV_COLUMNS}
            record['csv_line'] = line
            record['food'] = csv_food_id(record['food'])
            record['flags'] = []
            if not record['food'] or not record['image']:
                record['flags'].append('missing_image_or_food')
            for column in ('confidence', 'mask_fraction_of_image'):
                try:
                    number = float(record[column])
                    if not math.isfinite(number) or not 0 <= number <= 1:
                        raise ValueError()
                    record[column] = number
                except (ValueError, TypeError):
                    record[column] = None
                    record['flags'].append('invalid_' + column + '_expected_0_to_1')
            rows.append(record)
    return rows


def csv_waste_records(rows, references, min_confidence=0.5):
    """Return percentage of reference visible area, with confidence as a quality gate.

    Both numerator and denominator MUST be fractions of the whole image, with
    matching camera scale/framing. Plate-normalized references cannot be used.
    Each input row is one observation; no inferred counts or weight are used.
    """
    results = []
    for row in rows:
        record = {**row, 'flags': list(row['flags']), 'waste_percent': None,
                  'remaining_percent': None,
                  'reference_mask_fraction_of_image': references.get(row['food'])}
        ref = record['reference_mask_fraction_of_image']
        if record['flags']:
            record['status'] = 'invalid_row'
        elif row['confidence'] < min_confidence:
            record['status'] = 'low_confidence'
            record['flags'].append('below_min_confidence')
        elif ref is None:
            record['status'] = 'reference_required'
            record['flags'].append('full_portion_image_fraction_required')
        else:
            value = area_percentage(row['mask_fraction_of_image'], ref)
            record.update(waste_percent=round(value, 2), remaining_percent=round(value, 2), status='estimated')
            record['flags'].append('visible_area_proxy_assumes_matching_camera_scale')
            if value > 100:
                record['flags'].append('exceeds_reference_check_framing_and_portion_size')
            if value == 0:
                record['flags'].append('empty_mask_not_proof_of_consumption')
        results.append(record)
    return results


def process_csv(args, cfg):
    input_rows = read_detection_csv(args.csv_input)
    simulated = getattr(args, 'simulate_reference', False)
    synthetic_rows = []
    if simulated:
        records = []
        for row in input_rows:
            if row['food'] in ('plate', 'no_detection'):
                continue
            area = row['mask_fraction_of_image']
            if row['flags'] or row['confidence'] < args.min_confidence or not area:
                records.extend(csv_waste_records([row], {}, args.min_confidence))
                continue
            fraction = random.uniform(0.2, 0.8)
            reference = area / fraction
            synthetic_rows.append({
                'image': row['image'], 'food': row['food'],
                'confidence': row['confidence'],
                'mask_fraction_of_image': reference,
                'simulated': True,
            })
            record = csv_waste_records([row], {row['food']: reference}, args.min_confidence)[0]
            record['status'] = 'simulated'
            record['flags'] = ['simulated_random_reference_not_measured_waste']
            records.append(record)
    references = {}
    # This field is deliberately separate from legacy plate-normalized references.
    for key, food in cfg['foods'].items():
        ref = food.get('reference_mask_fraction_of_image')
        if ref is not None:
            if not isinstance(ref, (int, float)) or not math.isfinite(ref) or not 0 < ref <= 1:
                raise ValueError(f'{key}: reference_mask_fraction_of_image must be in (0, 1].')
            references[csv_food_id(key)] = ref
    if args.reference_csv:
        groups = {}
        for row in read_detection_csv(args.reference_csv):
            if row['flags'] or row['confidence'] < args.min_confidence or not row['mask_fraction_of_image']:
                raise ValueError(f'{args.reference_csv}: invalid/low-confidence/empty full-portion reference at line {row["csv_line"]}.')
            groups.setdefault(row['food'], []).append(row['mask_fraction_of_image'])
        # Repeated full-portion examples of a food use their median visible area.
        references.update({key: statistics.median(values) for key, values in groups.items()})
    if not simulated:
        records = csv_waste_records(input_rows, references, args.min_confidence)
    run = args.output / (datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S') + f'_{time.time_ns() % 1000000:06d}')
    run.mkdir(parents=True)
    if simulated:
        with (run / 'full_portions_simulated.csv').open('w', newline='', encoding='utf-8') as handle:
            writer = csv.DictWriter(handle, fieldnames=[*CSV_COLUMNS, 'simulated'])
            writer.writeheader()
            writer.writerows(synthetic_rows)
    fields = [*CSV_COLUMNS, 'waste_percent', 'remaining_percent',
              'reference_mask_fraction_of_image', 'status', 'csv_line', 'flags']
    with (run / 'results.csv').open('w', newline='', encoding='utf-8') as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for record in records:
            writer.writerow({**record, 'flags': ';'.join(record['flags'])})
    (run / 'results.json').write_text(json.dumps(records, indent=2) + '\n')
    summary = []
    for key in sorted({row['food'] for row in records}):
        group = [row for row in records if row['food'] == key]
        measured = [row['waste_percent'] for row in group if row['waste_percent'] is not None]
        summary.append({'food': key, 'input_rows': len(group), 'estimated_rows': len(measured),
                        'excluded_rows': len(group) - len(measured),
                        'mean_waste_percent': round(statistics.mean(measured), 2) if measured else None,
                        'scope': 'Simulated random percentages for demonstration.' if simulated else
                        'Mean visible-area percentage per CSV observation; repeated detections are not deduplicated.'})
    (run / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    (run / 'csv_references_used.json').write_text(json.dumps(references, indent=2) + '\n')
    for row in records:
        value = f'{row["waste_percent"]:.2f}%' if row['waste_percent'] is not None else row['status']
        print(f'{row["image"]}: {row["food"]}: {value}')
    print('Saved:', run.resolve())
    return run


def watch_csv_directory(args, cfg):
    """Process each new per-plate CSV after its writer has finished."""
    watch_dir = args.watch_dir
    watch_dir.mkdir(parents=True, exist_ok=True)
    processing = watch_dir / 'processing'
    processed = watch_dir / 'processed'
    failed = watch_dir / 'failed'
    for folder in (processing, processed, failed):
        folder.mkdir(exist_ok=True)
    for path in processing.glob('*.csv'):
        path.replace(watch_dir / path.name)

    # Include existing queued inputs, and wait for a stable size before claiming.
    previous_sizes = {}
    print(f'Watching for new per-plate CSVs in: {watch_dir.resolve()}')
    print('Press Ctrl+C to stop.')

    try:
        while True:
            for path in sorted(watch_dir.glob('*.csv')):
                key = path.resolve()
                try:
                    size = path.stat().st_size
                except FileNotFoundError:
                    continue

                if previous_sizes.get(key) == size:
                    processing_file = processing / path.name
                    path.replace(processing_file)
                    item_args = copy.copy(args)
                    item_args.csv_input = processing_file
                    try:
                        process_csv(item_args, cfg)
                        processing_file.replace(processed / path.name)
                    except Exception as error:
                        print(f'Could not process {path.name}: {error}')
                        processing_file.replace(failed / path.name)
                    previous_sizes.pop(key, None)
                else:
                    previous_sizes[key] = size

            time.sleep(0.5)
    except KeyboardInterrupt:
        print('\nStopped watching CSV folder.')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--config', type=Path, help='Optional schema-v2 geometry configuration')
    ap.add_argument('--init-config', type=Path, help='Create a config without overwriting an existing one')
    ap.add_argument('--food', default='chips', help='chips, pizza, cookie (operator-selected food type)')
    source = ap.add_mutually_exclusive_group()
    source.add_argument('--csv', '--input-csv', dest='csv_input', type=Path, help='CSV with image, food, confidence, mask_fraction_of_image')
    source.add_argument('--watch-dir', type=Path, help='Process each new per-plate CSV created in this folder')
    source.add_argument('--images', '--image', nargs='+', type=Path, help='Analyze still photos; JPG/PNG/HEIC supported')
    source.add_argument('--source', '--stream', help='DroidCam direct video URL, video filename, or camera index')
    ap.add_argument('--reference-csv', type=Path, help='Same four columns; each row depicts a known full portion')
    ap.add_argument('--simulate-reference', action='store_true',
                    help='Generate demo reference CSVs with random 20–80 percent waste; outputs are marked simulated')
    ap.add_argument('--min-confidence', type=float, default=0.5, help='CSV quality threshold in 0..1 (default 0.5)')
    ap.add_argument('--set-reference', action='store_true', help='Use the single input image as 100%; writes --config')
    ap.add_argument('--region', type=lambda s: normalized_points(s), help='Food search polygon: x1,y1,x2,y2,... in 0..1')
    ap.add_argument('--outline', type=lambda s: normalized_points(s), help='Manually supplied visible food silhouette polygon')
    ap.add_argument('--pizza-crust', type=lambda s: normalized_points(s, 2), help='Two endpoints of the intact original outer crust chord')
    ap.add_argument('--slice-angle', type=float, default=45, help='Original pizza wedge angle, 360 / original slice count')
    ap.add_argument('--cookie-rim', type=lambda s: normalized_points(s, 3), help='Three untouched original cookie rim points')
    ap.add_argument('--output', type=Path, default=Path('geometry_runs'))
    ap.add_argument('--headless', action='store_true', help='No video preview window')
    args = ap.parse_args()
    if not math.isfinite(args.min_confidence) or not 0 <= args.min_confidence <= 1:
        ap.error('--min-confidence must be between 0 and 1.')
    cfg = read_config(args.config)
    if args.simulate_reference and args.reference_csv:
        ap.error('Choose --simulate-reference or --reference-csv.')
    if args.simulate_reference and not (args.csv_input or args.watch_dir):
        ap.error('--simulate-reference requires --csv or --watch-dir.')
    if args.init_config:
        with args.init_config.open('x') as f:
            json.dump(cfg, f, indent=2); f.write('\n')
        print('Created', args.init_config)
        return
    if args.csv_input:
        if args.set_reference or any(x is not None for x in (args.region, args.outline, args.pizza_crust, args.cookie_rim)):
            ap.error('CSV mode uses --reference-csv; image geometry options do not apply.')
        process_csv(args, cfg)
        return
    if args.watch_dir:
        if args.set_reference or any(x is not None for x in (args.region, args.outline, args.pizza_crust, args.cookie_rim)):
            ap.error('CSV watch mode uses --reference-csv; image geometry options do not apply.')
        try:
            watch_csv_directory(args, cfg)
        except FileNotFoundError as error:
            ap.error(str(error))
        return
    if args.reference_csv:
        ap.error('--reference-csv requires --csv.')
    if cv2 is None or np is None or Image is None:
        ap.error('Image/video mode requires opencv-python, numpy and Pillow; CSV mode needs no packages.')
    if not args.images and args.source is None:
        ap.error('Provide --images PHOTO... or --source VIDEO_URL.')
    key = food_id(args.food)
    if args.pizza_crust is not None and key != ALIASES['pizza']:
        ap.error('--pizza-crust requires --food pizza')
    if args.cookie_rim is not None and key != ALIASES['cookie']:
        ap.error('--cookie-rim requires --food cookie')
    for polygon in [args.region, args.outline]:
        if polygon is not None and len(polygon) < 3:
            ap.error('Polygons need at least three points.')
    if args.set_reference and (not args.config or not args.images or len(args.images) != 1):
        ap.error('--set-reference requires --config PATH and exactly one --images PHOTO.')
    if args.set_reference and (args.pizza_crust is not None or args.cookie_rim is not None):
        ap.error('A reference photo and reconstructed geometry are separate methods.')
    if args.source is not None and (args.outline is not None or args.pizza_crust is not None or args.cookie_rim is not None):
        ap.error('Fixed image outline/rim coordinates are for still images only. Calibrate a photo reference for streams.')
    run = args.output / (datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S') + f'_{time.time_ns() % 1000000:06d}')
    run.mkdir(parents=True)
    records = []
    if args.images:
        for index, path in enumerate(args.images):
            frame = load_image(path, cfg['max_image_side'])
            plates = detect_plates(frame, cfg)
            if not plates:
                record = {'image': path.name, 'food': key, 'remaining_percent': None, 'flags': ['plate_not_detected']}
                records.append(record); print(json.dumps(record)); continue
            # Still-photo mode measures the largest detected plate only.
            plate = plates[0]
            result, mask = measure(frame, plate, key, cfg, args)
            if args.set_reference:
                if result['food_plate_area_fraction'] <= 0:
                    raise ValueError('No food detected; cannot use an empty mask as a full reference.')
                cfg['foods'][key]['reference_fraction'] = result['food_plate_area_fraction']
                cfg['foods'][key]['reference_description'] = f'User-designated full portion in {path.name}'
                args.config.write_text(json.dumps(cfg, indent=2) + '\n')
                result, mask = measure(frame, plate, key, cfg, args)
            result.update(image=path.name, timestamp_utc=datetime.now(timezone.utc).isoformat(), plate_id=index + 1)
            records.append(result)
            cv2.imwrite(str(run / f'{index+1:03d}_{path.stem}_overlay.jpg'), draw_result(frame, plate, result, mask))
            cv2.imwrite(str(run / f'{index+1:03d}_{path.stem}_mask.png'), mask)
            print(json.dumps(result))
        save_results(run, records)
    else:
        if cfg['foods'][key].get('reference_fraction') is None:
            ap.error('This food needs a full-portion photo reference before live-stream estimates. No weight is needed.')
        src = int(args.source) if args.source.isdigit() else args.source
        cap = cv2.VideoCapture(src)
        if not cap.isOpened():
            raise RuntimeError('Cannot open camera/stream. Use the direct video feed URL, not the browser control page.')
        tracker = Tracker(cfg)
        try:
            while True:
                ok, frame = cap.read()
                if not ok:
                    print('Stream ended/disconnected; results saved. Restart creates a new run.'); break
                h, w = frame.shape[:2]
                scale = min(1., cfg['max_image_side'] / max(h, w))
                if scale < 1:
                    frame = cv2.resize(frame, (int(w*scale), int(h*scale)))
                plates = detect_plates(frame, cfg)
                overlay = frame.copy()
                for tid, track, plate in tracker.update(plates, time.monotonic()):
                    result, mask = measure(frame, plate, key, cfg, args)
                    # A crop can be extrapolated in reviewed stills; live measurements require a full plate.
                    if plate['visible_fraction'] < .97:
                        continue
                    coordinate = plate['center'][0 if cfg['axis'] == 'x' else 1]
                    signed = cfg['direction'] * (coordinate - cfg['count_line'])
                    if signed < -cfg['arming_margin']:
                        track['armed'] = True
                    track['samples'] = (track['samples'] + [result])[-3:]
                    if track['armed'] and not track['counted'] and signed >= 0:
                        track['counted'] = True
                        chosen = sorted(track['samples'], key=lambda r: r['remaining_percent'])[len(track['samples'])//2].copy()
                        chosen.update(timestamp_utc=datetime.now(timezone.utc).isoformat(), plate_id=tid)
                        records.append(chosen); print(json.dumps(chosen)); save_results(run, records)
                    overlay = draw_result(overlay, plate, result, mask)
                if not args.headless:
                    h, w = overlay.shape[:2]
                    pos = int(cfg['count_line'] * (w if cfg['axis'] == 'x' else h))
                    cv2.line(overlay, (pos, 0) if cfg['axis']=='x' else (0, pos),
                             (pos, h) if cfg['axis']=='x' else (w, pos), (255, 100, 0), 2)
                    cv2.imshow('Visible area remaining - Q to quit', overlay)
                    if cv2.waitKey(1) & 0xff == ord('q'):
                        break
        except KeyboardInterrupt:
            pass
        finally:
            cap.release()
            if not args.headless:
                cv2.destroyAllWindows()
            save_results(run, records)
    (run / 'geometry_config_used.json').write_text(json.dumps(cfg, indent=2) + '\n')
    print('Saved:', run.resolve())


if __name__ == '__main__':
    main()
