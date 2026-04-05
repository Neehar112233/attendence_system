"""Face detection, encoding, and comparison service."""

import face_recognition
import numpy as np
import cv2
import base64
import os
from io import BytesIO
from PIL import Image
import config


def decode_base64_image(base64_string):
    """Decode a base64 image string to a numpy array (RGB)."""
    # Remove data URL prefix if present
    if "," in base64_string:
        base64_string = base64_string.split(",")[1]

    image_bytes = base64.b64decode(base64_string)
    image = Image.open(BytesIO(image_bytes))
    image = image.convert("RGB")
    return np.array(image)


def detect_and_encode(image_array):
    """
    Detect face(s) in an image and return the encoding of the first face found.
    Returns (encoding_list, face_locations) or (None, None) if no face detected.
    """
    # Detect face locations
    face_locations = face_recognition.face_locations(
        image_array, model=config.FACE_MODEL
    )

    if not face_locations:
        return None, None

    # Get face encodings
    encodings = face_recognition.face_encodings(image_array, face_locations)

    if not encodings:
        return None, None

    # Return first face encoding as a list (for MongoDB storage)
    return encodings[0].tolist(), face_locations


def compare_faces(known_students, unknown_encoding):
    """
    Compare an unknown face encoding against all known student encodings.
    Returns the best matching student or None.
    """
    if not known_students or unknown_encoding is None:
        return None

    known_encodings = []
    valid_students = []

    for student in known_students:
        if student.get("face_encoding"):
            known_encodings.append(np.array(student["face_encoding"]))
            valid_students.append(student)

    if not known_encodings:
        return None

    unknown_np = np.array(unknown_encoding)

    # Compare faces
    matches = face_recognition.compare_faces(
        known_encodings, unknown_np, tolerance=config.FACE_TOLERANCE
    )

    # Calculate face distances for best match
    face_distances = face_recognition.face_distance(known_encodings, unknown_np)

    if True in matches:
        # Get the best match (lowest distance)
        best_match_index = np.argmin(face_distances)
        if matches[best_match_index]:
            student = valid_students[best_match_index]
            confidence = round((1 - face_distances[best_match_index]) * 100, 2)
            return {
                "_id": student["_id"],
                "name": student["name"],
                "roll": student["roll"],
                "section": student.get("section", ""),
                "branch": student.get("branch", ""),
                "confidence": confidence
            }

    return None


def save_face_image(image_array, roll_number):
    """Save the captured face image to disk."""
    filename = f"{roll_number}.jpg"
    filepath = os.path.join(config.CAPTURED_FACES_DIR, filename)

    # Convert RGB to BGR for OpenCV
    bgr_image = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
    cv2.imwrite(filepath, bgr_image)

    return filepath


def draw_face_boxes(image_array, face_locations, names=None):
    """Draw bounding boxes around detected faces (for display purposes)."""
    img = image_array.copy()

    for i, (top, right, bottom, left) in enumerate(face_locations):
        # Draw rectangle
        cv2.rectangle(img, (left, top), (right, bottom), (0, 255, 100), 2)

        # Draw label
        if names and i < len(names):
            label = names[i]
            cv2.rectangle(img, (left, bottom - 30), (right, bottom), (0, 255, 100), cv2.FILLED)
            cv2.putText(img, label, (left + 6, bottom - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)

    return img


def encode_image_to_base64(image_array):
    """Convert a numpy image array to base64 string for sending to frontend."""
    # Convert RGB to BGR for OpenCV encoding
    bgr = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
    _, buffer = cv2.imencode('.jpg', bgr)
    return base64.b64encode(buffer).decode('utf-8')
