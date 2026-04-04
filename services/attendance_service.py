"""Attendance business logic service."""

from models import database as db
from services import face_service
from datetime import datetime


def register_student(name, roll, section, branch, face_image_base64):
    """
    Register a new student:
    1. Decode the face image
    2. Detect and encode the face
    3. Save face image to disk
    4. Store student data + encoding in MongoDB
    """
    # Check if roll number already exists
    existing = db.get_student_by_roll(roll)
    if existing:
        return {"success": False, "message": f"Student with roll number {roll} already exists."}

    # Decode base64 image
    try:
        image_array = face_service.decode_base64_image(face_image_base64)
    except Exception as e:
        return {"success": False, "message": f"Invalid image data: {str(e)}"}

    # Detect and encode face
    encoding, face_locations = face_service.detect_and_encode(image_array)

    if encoding is None:
        return {"success": False, "message": "No face detected in the image. Please try again with a clear face photo."}

    # Save face image
    face_path = face_service.save_face_image(image_array, roll)

    # Store in database
    try:
        student_id = db.add_student(name, roll, section, branch, encoding, face_path)
        return {
            "success": True,
            "message": f"Student {name} registered successfully!",
            "student_id": student_id
        }
    except Exception as e:
        if "duplicate key" in str(e).lower():
            return {"success": False, "message": f"Roll number {roll} is already registered."}
        return {"success": False, "message": f"Database error: {str(e)}"}


def recognize_and_mark(face_image_base64, subject):
    """
    Recognize face from image and mark attendance:
    1. Decode the image
    2. Detect faces
    3. Compare against all registered students
    4. Mark attendance for recognized students
    """
    # Decode image
    try:
        image_array = face_service.decode_base64_image(face_image_base64)
    except Exception as e:
        return {"success": False, "message": f"Invalid image data: {str(e)}", "results": []}

    # Detect faces
    encoding, face_locations = face_service.detect_and_encode(image_array)

    if encoding is None:
        return {"success": False, "message": "No face detected. Please position your face clearly in front of the camera.", "results": []}

    # Load all known students
    known_students = db.get_all_face_encodings()

    if not known_students:
        return {"success": False, "message": "No students registered yet. Please register students first.", "results": []}

    # Compare face
    match = face_service.compare_faces(known_students, encoding)

    if match is None:
        return {
            "success": False,
            "message": "Face not recognized. Student may not be registered.",
            "results": []
        }

    # Check if already marked today
    already_marked = db.is_already_marked(match["roll"], subject)

    if already_marked:
        return {
            "success": True,
            "message": f"{match['name']} — Attendance in {subject} already marked for today!",
            "results": [{
                "name": match["name"],
                "roll": match["roll"],
                "section": match["section"],
                "branch": match["branch"],
                "subject": subject,
                "confidence": match["confidence"],
                "already_marked": True
            }]
        }

    # Mark attendance
    record_id = db.mark_attendance(
        match["_id"], match["name"], match["roll"],
        match["section"], match["branch"], subject
    )

    return {
        "success": True,
        "message": f"✅ Attendance marked for {match['name']} in {subject}",
        "results": [{
            "name": match["name"],
            "roll": match["roll"],
            "section": match["section"],
            "branch": match["branch"],
            "subject": subject,
            "confidence": match["confidence"],
            "already_marked": False
        }]
    }


def get_dashboard_stats():
    """Get statistics for the dashboard."""
    total_students = db.get_student_count()
    today_present = db.get_today_attendance_count()
    today = datetime.now().strftime("%Y-%m-%d")

    return {
        "total_students": total_students,
        "today_present": today_present,
        "today_absent": max(0, total_students - today_present),
        "attendance_rate": round((today_present / total_students * 100), 1) if total_students > 0 else 0,
        "date": today
    }
