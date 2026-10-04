from ultralytics import YOLO

if __name__ == "__main__":
    model = YOLO("yolov8n-seg.pt")
    model.train(
        data=r"D:\Development\mhacks26\My First Project.v4i.yolov8\data.yaml",
        epochs=30,
        imgsz=640,
        workers=0,
    )