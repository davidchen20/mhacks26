import csv
import time
from pathlib import Path
import cv2
from ultralytics import YOLO


BASE_DIR = Path(__file__).resolve().parent
CAPTURES_DIR = BASE_DIR / "captures"
PENDING_DIR = CAPTURES_DIR / "pending"
PROCESSING_DIR = CAPTURES_DIR / "processing"
PROCESSED_DIR = CAPTURES_DIR / "processed"
FAILED_DIR = CAPTURES_DIR / "failed"
PER_PLATE_RESULTS_DIR = CAPTURES_DIR / "plate_results"
RESULTS_FILE = BASE_DIR / "waste_results.csv"

MODEL_FILE = Path(
    r"D:\Development\mhacks26\runs\segment\train-5\weights\best.pt"
)


def make_result_rows(image_name, result, model):
    rows = []

    if result.masks is None or result.boxes is None or len(result.boxes) == 0:
        return [{
            "image": image_name,
            "food": "no detection",
            "confidence": "",
            "mask_fraction_of_image": 0,
        }]

    masks = result.masks.data.cpu().numpy()
    class_ids = result.boxes.cls.int().cpu().tolist()
    confidences = result.boxes.conf.cpu().tolist()

    for mask, class_id, confidence in zip(masks, class_ids, confidences):
        rows.append({
            "image": image_name,
            "food": model.names[class_id],
            "confidence": round(float(confidence), 3),
            "mask_fraction_of_image": round(float(mask.mean()), 4),
        })

    return rows


def append_rows(rows):
    fieldnames = [
        "image",
        "food",
        "confidence",
        "mask_fraction_of_image",
    ]
    write_header = not RESULTS_FILE.exists() or RESULTS_FILE.stat().st_size == 0

    with RESULTS_FILE.open("a", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)

        if write_header:
            writer.writeheader()

        writer.writerows(rows)


def write_plate_csv(image_name, rows):
    """Write this captured plate's detections to its own CSV file."""
    PER_PLATE_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output_file = PER_PLATE_RESULTS_DIR / f"{Path(image_name).stem}.csv"
    fieldnames = [
        "image",
        "food",
        "confidence",
        "mask_fraction_of_image",
    ]

    with output_file.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    return output_file


def main():
    for folder in (PENDING_DIR, PROCESSING_DIR, PROCESSED_DIR, FAILED_DIR):
        folder.mkdir(parents=True, exist_ok=True)

    # If the worker stopped during a previous run, put unfinished photos
    # back into the queue.
    for image_path in PROCESSING_DIR.glob("*.jpg"):
        image_path.replace(PENDING_DIR / image_path.name)

    print(f"Loading model: {MODEL_FILE}")
    model = YOLO(str(MODEL_FILE))
    print(model.names)
    print("Queue worker running. Press Ctrl+C to stop.")

    try:
        while True:
            queued_images = sorted(PENDING_DIR.glob("*.jpg"))

            if not queued_images:
                time.sleep(0.5)
                continue

            queued_file = queued_images[0]
            processing_file = PROCESSING_DIR / queued_file.name

            # Move it out of pending before processing it.
            queued_file.replace(processing_file)

            try:
                image = cv2.imread(str(processing_file))
                if image is None:
                    raise ValueError(f"Could not open image: {processing_file}")

                # First pass finds the plate in the full photo.
                full_result = model.predict(
                    source=image,
                    imgsz=640,
                    conf=0.1,
                    verbose=False,
                )[0]

                # Second pass looks more closely at the plate crop.
                plate_crop = crop_around_plate(image, full_result, model)
                result = model.predict(
                    source=plate_crop,
                    imgsz=960,
                    conf=0.01,
                    verbose=False,
                )[0]

                rows = make_result_rows(processing_file.name, result, model)
                append_rows(rows)
                plate_csv = write_plate_csv(processing_file.name, rows)

                processing_file.replace(PROCESSED_DIR / processing_file.name)
                print(f"Processed: {processing_file.name} -> {plate_csv}")

            except Exception as error:
                print(f"Failed: {processing_file.name}: {error}")
                processing_file.replace(FAILED_DIR / processing_file.name)

    except KeyboardInterrupt:
        print("\nWorker stopped. Remaining pending photos are still queued.")

def crop_around_plate(image, result, model, padding=0.12):
    if result.boxes is None or len(result.boxes) == 0:
        return image

    plate_id = next(
        (class_id for class_id, name in model.names.items() if name == "plate"),
        None,
    )

    if plate_id is None:
        return image

    class_ids = result.boxes.cls.int().cpu().tolist()
    confidences = result.boxes.conf.cpu().tolist()

    plate_indices = [
        i for i, class_id in enumerate(class_ids)
        if class_id == plate_id
    ]

    if not plate_indices:
        return image

    # Use the highest-confidence plate detection.
    best_index = max(plate_indices, key=lambda i: confidences[i])
    x1, y1, x2, y2 = result.boxes.xyxy[best_index].cpu().tolist()

    height, width = image.shape[:2]
    pad_x = int((x2 - x1) * padding)
    pad_y = int((y2 - y1) * padding)

    left = max(0, int(x1) - pad_x)
    top = max(0, int(y1) - pad_y)
    right = min(width, int(x2) + pad_x)
    bottom = min(height, int(y2) + pad_y)

    return image[top:bottom, left:right]

if __name__ == "__main__":
    main()
