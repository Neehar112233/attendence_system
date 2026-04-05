"""MongoDB database connection and operations."""

from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from datetime import datetime
from bson import ObjectId
import config
import certifi

# MongoDB Connection (lazy initialization)
_client = None
_db = None


def get_db():
    """Get MongoDB database connection (lazy init with short timeout)."""
    global _client, _db
    if _db is None:
        _client = MongoClient(config.MONGO_URI, serverSelectionTimeoutMS=5000, tlsCAFile=certifi.where())
        _db = _client[config.DATABASE_NAME]
        # Create indexes
        try:
            _db[config.STUDENTS_COLLECTION].create_index("roll", unique=True)
            _db[config.ATTENDANCE_COLLECTION].create_index([("roll", 1), ("date", 1)])
        except Exception:
            pass  # Indexes may already exist
    return _db


def get_students_col():
    return get_db()[config.STUDENTS_COLLECTION]


def get_attendance_col():
    return get_db()[config.ATTENDANCE_COLLECTION]


# ─── Student Operations ──────────────────────────────────────────────

def add_student(name, roll, section, branch, face_encoding, face_image_path):
    """Register a new student with their face encoding."""
    student = {
        "name": name,
        "roll": roll,
        "section": section,
        "branch": branch,
        "face_encoding": face_encoding,
        "face_image_path": face_image_path,
        "registered_at": datetime.now()
    }
    result = get_students_col().insert_one(student)
    return str(result.inserted_id)


def get_all_students():
    """Get all registered students."""
    students = list(get_students_col().find({}, {"face_encoding": 0}))
    for s in students:
        s["_id"] = str(s["_id"])
        if "registered_at" in s and s["registered_at"]:
            s["registered_at"] = s["registered_at"].isoformat()
    return students


def get_student_by_roll(roll):
    """Find a student by roll number."""
    student = get_students_col().find_one({"roll": roll})
    if student:
        student["_id"] = str(student["_id"])
    return student


def get_all_face_encodings():
    """Get all students with their face encodings for comparison."""
    students = list(get_students_col().find({}, {
        "name": 1, "roll": 1, "section": 1, "branch": 1, "face_encoding": 1
    }))
    for s in students:
        s["_id"] = str(s["_id"])
    return students


def delete_student(roll):
    """Delete a student by roll number."""
    result = get_students_col().delete_one({"roll": roll})
    return result.deleted_count > 0


def get_student_count():
    """Get total number of registered students."""
    try:
        return get_students_col().count_documents({})
    except Exception:
        return 0


# ─── Attendance Operations ─────────────────────────────────────────

def mark_attendance(student_id, name, roll, section, branch, subject):
    """Mark attendance for a student. Prevents duplicates for the same day and subject."""
    today = datetime.now().strftime("%Y-%m-%d")

    # Check if already marked today for this subject
    existing = get_attendance_col().find_one({"roll": roll, "date": today, "subject": subject})
    if existing:
        return None  # Already marked

    record = {
        "student_id": student_id,
        "name": name,
        "roll": roll,
        "section": section,
        "branch": branch,
        "subject": subject,
        "timestamp": datetime.now(),
        "date": today,
        "time": datetime.now().strftime("%H:%M:%S"),
        "status": "Present"
    }
    result = get_attendance_col().insert_one(record)
    return str(result.inserted_id)


def get_attendance_by_date(date_str):
    """Fetch all attendance records for a given date."""
    records = list(get_attendance_col().find(
        {"date": date_str},
        {"_id": 0}
    ).sort("timestamp", -1))
    for r in records:
        if "timestamp" in r:
            r["timestamp"] = r["timestamp"].isoformat()
    return records


def get_attendance_by_student(roll):
    """Fetch attendance history for a student."""
    records = list(get_attendance_col().find(
        {"roll": roll},
        {"_id": 0}
    ).sort("timestamp", -1))
    for r in records:
        if "timestamp" in r:
            r["timestamp"] = r["timestamp"].isoformat()
    return records


def get_today_attendance_count():
    """Get number of students marked present today."""
    try:
        today = datetime.now().strftime("%Y-%m-%d")
        return get_attendance_col().count_documents({"date": today})
    except Exception:
        return 0


def get_all_dates():
    """Get all unique dates that have attendance records."""
    try:
        dates = get_attendance_col().distinct("date")
        dates.sort(reverse=True)
        return dates
    except Exception:
        return []


def is_already_marked(roll, subject):
    """Check if a student is already marked for today in a specific subject."""
    today = datetime.now().strftime("%Y-%m-%d")
    return get_attendance_col().find_one({"roll": roll, "date": today, "subject": subject}) is not None
