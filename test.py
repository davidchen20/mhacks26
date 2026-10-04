from ultralytics import YOLO

model = YOLO(r"D:\Development\mhacks26\runs\segment\train-5\weights\best.pt")
model.predict(source=r"D:\Development\mhacks26\captures\processed\plate_20261003_205201_199240.jpg", show=True, save=True)

# from pathlib import Path
# from ultralytics import YOLO

# image = r"D:\Development\mhacks26\captures\processed\plate_20261003_204351_111667.jpg"
# MODEL_FILE = Path(
#     r"D:\Development\mhacks26\runs\segment\train-6\weights\best.pt"
# )

# model = YOLO(str(MODEL_FILE))

# result = model.predict(
#     source=image,
#     imgsz=640,
#     conf=0.05,
#     verbose=False,
# )[0]

# print("Model classes:", model.names)

# for class_id, confidence in zip(
#     result.boxes.cls.int().tolist(),
#     result.boxes.conf.tolist(),
# ):
#     print(model.names[class_id], round(confidence, 3))