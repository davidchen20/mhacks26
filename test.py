from ultralytics import YOLO

model = YOLO(r"D:\Development\mhacks26\runs\segment\train-6\weights\best.pt")
model.predict(source=r"D:\Development\mhacks26\My First Project.v3i.yolov8\train\images\IMG_7553_HEIC.rf.ca9c9ba403ea660cfd2dd88f43d5d2a2.jpg", show=True, save=True)