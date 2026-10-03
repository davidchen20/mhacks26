from ultralytics import YOLO

model = YOLO(r"D:\Development\mhacks26\runs\segment\train-4\weights\best.pt")
model.predict(source=r"D:\Development\mhacks26\captures\plate_20261003_144752_749881.jpg", show=True, save=True)