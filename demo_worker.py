"""Run one instance beside ai_detection.py. Mock inference, real DB writes."""
import json
import logging
import os
import random
import time
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo
from api.demo_store import FOODS, insert_observation

BASE = Path(__file__).resolve().parent / 'captures'
PENDING, PROCESSING, PROCESSED = (BASE / n for n in ('pending', 'processing', 'processed'))


def mock_inference(image):
    # Camera writes plate_YYYYMMDD_HHMMSS_microseconds.jpg atomically.
    # Its filename is local time on the capture computer; configure that machine
    # for America/New_York. Freeze service scope before retrying DB writes.
    captured = datetime.strptime(image.stem, 'plate_%Y%m%d_%H%M%S_%f').replace(
        tzinfo=ZoneInfo('America/New_York'))
    meal = os.environ.get('DEMO_MEAL', 'dinner').lower()
    if meal not in {'breakfast', 'brunch', 'lunch', 'dinner'}:
        raise ValueError('Invalid DEMO_MEAL')
    epoch = datetime(2020, 1, 1, tzinfo=timezone.utc)
    delta = captured.astimezone(timezone.utc) - epoch
    microseconds = ((delta.days * 86400 + delta.seconds) * 1000000
                    + delta.microseconds)
    records = []
    for index, food in enumerate(random.sample(list(FOODS), random.randint(1, 3))):
        lbs, _, calories, fiber, protein = FOODS[food]
        identifier = microseconds * 4 + index
        if not 0 <= identifier < 2**53:
            raise ValueError('Capture timestamp outside supported ID range')
        records.append(dict(id=str(identifier), food=food, dining_hall='MHacks Demo',
            service_date=captured.date().isoformat(), meal=meal,
            waste_percent=round(random.uniform(5, 65), 1), observations=1,
            simulated=False, station='Phone camera / mock inference', name=food,
            serving_size=f'{lbs * 16:g} oz', calories=calories, fiber=fiber, protein=protein,
            traits=[], allergens=[]))
    return records


def process_image(image):
    result = image.with_suffix(image.suffix + '.json')
    if not result.exists():
        temporary = result.with_suffix('.tmp')
        temporary.write_text(json.dumps(mock_inference(image)), encoding='utf-8')
        temporary.replace(result)
    for record in json.loads(result.read_text(encoding='utf-8')):
        insert_observation(record)
    image.replace(PROCESSED / image.name)
    result.replace(PROCESSED / result.name)


def main():
    for folder in (PENDING, PROCESSING, PROCESSED):
        folder.mkdir(parents=True, exist_ok=True)
    while True:
        for image in PENDING.iterdir():
            if image.suffix.lower() in {'.jpg', '.jpeg', '.png'}:
                image.replace(PROCESSING / image.name)
        for image in PROCESSING.iterdir():
            if image.suffix.lower() not in {'.jpg', '.jpeg', '.png'}:
                continue
            try:
                process_image(image)
                logging.info('Uploaded %s', image.name)
            except Exception:
                logging.exception('Keeping %s queued for retry', image.name)
        time.sleep(2)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    main()
