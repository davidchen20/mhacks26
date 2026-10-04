from datetime import datetime
from pathlib import Path

import cv2


BASE_DIR = Path(__file__).resolve().parent
CAPTURES_DIR = BASE_DIR / "captures"
PENDING_DIR = CAPTURES_DIR / "pending"
STAGING_DIR = CAPTURES_DIR / "staging"

# Replace this with the current URL shown by your iPhone camera app.
STREAM_URL = "http://100.64.14.237:4747/video"


def main():
    PENDING_DIR.mkdir(parents=True, exist_ok=True)
    STAGING_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Connecting to camera: {STREAM_URL}")
    cap = cv2.VideoCapture(STREAM_URL)

    if not cap.isOpened():
        print("Could not open the camera stream. Check STREAM_URL.")
        return

    print("Camera is running. Press S to queue a photo; Q to quit.")

    try:
        while True:
            ret, frame = cap.read()

            if not ret:
                print("Could not read a frame from the camera.")
                break

            cv2.imshow("Camera — S to queue, Q to quit", frame)
            key = cv2.waitKey(1) & 0xFF

            if key == ord("s"):
                filename = f"plate_{datetime.now():%Y%m%d_%H%M%S_%f}.jpg"
                temporary_file = STAGING_DIR / filename
                queued_file = PENDING_DIR / filename

                # Write to staging first. The worker only watches pending.
                if cv2.imwrite(str(temporary_file), frame):
                    temporary_file.replace(queued_file)
                    print(f"Queued: {queued_file.name}")
                else:
                    print("Could not save the photo.")

            elif key == ord("q"):
                break

    finally:
        cap.release()
        cv2.destroyAllWindows()
        print("Camera stopped. Photos still in pending will remain queued.")


if __name__ == "__main__":
    main()