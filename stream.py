import cv2

# Replace with the exact IP and Port shown on your iPhone screen
# Note the '/video' at the end of the URL string
URL = "http://100.64.14.68:4747/video" 

def main():
    print(f"Attempting to connect to DroidCam stream at {URL}...")
    
    # OpenCV natively decodes IP video streams! No drivers required.
    cap = cv2.VideoCapture(URL)

    if not cap.isOpened():
        print("Error: Could not open the DroidCam network stream.")
        return

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Lost stream connection.")
            break

        # --- PROCESS FRAME HERE ---
        # Example: Mirror the camera image
        processed_frame = cv2.flip(frame, 1)
        # --------------------------

        cv2.imshow('DroidCam OpenCV Stream', processed_frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == '__main__':
    main()