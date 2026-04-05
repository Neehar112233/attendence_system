"""Configuration for the Smart Face Attendance System."""

import os

# MongoDB Configuration
MONGO_URI = "mongodb+srv://neehar:neehar%402006@attendence.ujd8pec.mongodb.net/"
DATABASE_NAME = "face_attendance_db"

# Collections
STUDENTS_COLLECTION = "students"
ATTENDANCE_COLLECTION = "attendance"

# Face Recognition
FACE_TOLERANCE = 0.5  # Lower = more strict matching
FACE_MODEL = "hog"    # "hog" for CPU, "cnn" for GPU (slower but more accurate)

# File Storage
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CAPTURED_FACES_DIR = os.path.join(BASE_DIR, "captured_faces")

# Ensure directories exist
os.makedirs(CAPTURED_FACES_DIR, exist_ok=True)

# Flask
SECRET_KEY = "face-attendance-secret-key-2026"
DEBUG = True
HOST = "0.0.0.0"
PORT = 5000
