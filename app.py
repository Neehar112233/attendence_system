"""Smart AI Face Attendance System — Flask Application."""

from flask import Flask, render_template, request, jsonify
import config
from services import attendance_service
from models import database as db

app = Flask(__name__)
app.secret_key = config.SECRET_KEY


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PAGE ROUTES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.route("/")
def index():
    """Landing page."""
    return render_template("index.html")


@app.route("/register")
def register_page():
    """Student registration page."""
    return render_template("register.html")


@app.route("/attendance")
def attendance_page():
    """Take attendance page."""
    return render_template("attendance.html")


@app.route("/dashboard")
def dashboard_page():
    """Attendance dashboard page."""
    return render_template("dashboard.html")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# API ROUTES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.route("/api/register", methods=["POST"])
def api_register():
    """Register a new student with face data."""
    data = request.get_json()

    name = data.get("name", "").strip()
    roll = data.get("roll", "").strip()
    section = data.get("section", "").strip()
    branch = data.get("branch", "").strip()
    face_image = data.get("face_image", "")

    # Validate required fields
    if not all([name, roll, section, branch, face_image]):
        return jsonify({
            "success": False,
            "message": "All fields are required. Please fill in all details and capture your face."
        }), 400

    result = attendance_service.register_student(name, roll, section, branch, face_image)

    status_code = 200 if result["success"] else 400
    return jsonify(result), status_code


@app.route("/api/mark-attendance", methods=["POST"])
def api_mark_attendance():
    """Recognize face and mark attendance."""
    data = request.get_json()
    face_image = data.get("face_image", "")
    subject = data.get("subject", "")

    if not face_image:
        return jsonify({
            "success": False,
            "message": "No image data received."
        }), 400
        
    if not subject:
        return jsonify({
            "success": False,
            "message": "Subject is required."
        }), 400

    result = attendance_service.recognize_and_mark(face_image, subject)
    return jsonify(result)


@app.route("/api/students", methods=["GET"])
def api_get_students():
    """Get all registered students."""
    students = db.get_all_students()
    return jsonify({"students": students, "count": len(students)})


@app.route("/api/attendance", methods=["GET"])
def api_get_attendance():
    """Get attendance records with optional date filter."""
    date = request.args.get("date", "")
    roll = request.args.get("roll", "")

    if roll:
        records = db.get_attendance_by_student(roll)
    elif date:
        records = db.get_attendance_by_date(date)
    else:
        # Default: today's attendance
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        records = db.get_attendance_by_date(today)

    return jsonify({"records": records, "count": len(records)})


@app.route("/api/stats", methods=["GET"])
def api_get_stats():
    """Get dashboard statistics."""
    stats = attendance_service.get_dashboard_stats()
    return jsonify(stats)


@app.route("/api/dates", methods=["GET"])
def api_get_dates():
    """Get all available attendance dates."""
    dates = db.get_all_dates()
    return jsonify({"dates": dates})


@app.route("/api/students/<roll>", methods=["DELETE"])
def api_delete_student(roll):
    """Delete a student by roll number."""
    success = db.delete_student(roll)
    if success:
        return jsonify({"success": True, "message": f"Student {roll} deleted."})
    return jsonify({"success": False, "message": "Student not found."}), 404


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if __name__ == "__main__":
    print("\n╔══════════════════════════════════════════════════╗")
    print("║   🎯 Smart AI Face Attendance System             ║")
    print("║   Running on http://localhost:5000               ║")
    print("╚══════════════════════════════════════════════════╝\n")
    app.run(host=config.HOST, port=config.PORT, debug=config.DEBUG)
