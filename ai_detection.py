import cv2
from ultralytics import YOLO
from pathlib import Path
from datetime import datetime

capture_dir = Path("captures")
capture_dir.mkdir(exist_ok=True)

def main():
    # 1. Load the pre-trained YOLOv8 Nano model (lightweight, perfect for laptops)
    # The framework will automatically download this small file on the first run
    print("Loading AI Model...")
    # model = YOLO("yolov8n.pt") 
    model = YOLO(r"D:\Development\mhacks26\runs\segment\train-4\weights\best.pt")
    
    # 2. Connect to your wireless iPhone video stream
    # (Replace this URL with your working DroidCam/Larix network link)
    STREAM_URL = "http://100.64.14.237:4747/video" 
    
    print(f"Connecting to live feed: {STREAM_URL}")
    cap = cv2.VideoCapture(STREAM_URL)

    if not cap.isOpened():
        print("Error: Could not open video stream.")
        return

    print("AI Model loaded successfully! Press 'q' to quit.")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        cv2.imshow("Camera", frame)
        key = cv2.waitKey(1) & 0xFF

        if key == ord("s"):
            filename = capture_dir / f"plate_{datetime.now():%Y%m%d_%H%M%S_%f}.jpg"

            if cv2.imwrite(str(filename), frame):
                print(f"Saved: {filename.resolve()}")
            else:
                print("Could not save the image.")

        result = model.predict(frame, imgsz=640, verbose=False)[0]
        annotated_frame = result.plot()  # Draws masks, labels, and boxes

        if result.masks is not None:
            masks = result.masks.data.cpu().numpy()
            class_ids = result.boxes.cls.int().cpu().tolist()

            for mask, class_id in zip(masks, class_ids):
                # Resize the mask to match the camera frame
                mask = cv2.resize(
                    mask.astype("uint8"),
                    (frame.shape[1], frame.shape[0]),
                    interpolation=cv2.INTER_NEAREST,
                )

                pixel_area = int(mask.sum())
                label = model.names[class_id]
                print(f"{label}: mask covers {pixel_area} pixels")

        cv2.imshow("Live iPhone AI Segmentation", annotated_frame)

        # Press 'q' to close the program
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == '__main__':
    main()
