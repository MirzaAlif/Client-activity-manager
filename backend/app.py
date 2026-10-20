"""
app.py  -  the backend (API server) built with Flask.

The frontend never touches the database. It sends requests to the URLs below,
and this file validates the data, talks to the database, and sends back JSON.

Flow:  Browser (React)  ->  Flask route  ->  validate  ->  SQL  ->  JSON back
"""
import os
import re
import sqlite3
from datetime import datetime

from flask import Flask, jsonify, request, send_from_directory

from database import fetch_all, fetch_one, run, init_db

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend")
app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")

STATUSES = ["Pending", "In Progress", "Completed"]
EMAIL_PATTERN = r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$"
PHONE_PATTERN = r"^[+\d][\d\s()-]{6,18}$"


# ---------------------------------------------------------------
# CORS: lets the page work even if index.html was double-clicked (file://)
# The browser first asks "am I allowed to call you?" (an OPTIONS request).
# These two small functions answer "yes". (Fine for a local demo; in
# production you would only allow your own website's address.)
# ---------------------------------------------------------------
@app.before_request
def answer_preflight():
    if request.method == "OPTIONS":
        return "", 204


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    return response


# ---------------------------------------------------------------
# VALIDATION  (same rules as the original demo, now enforced on the server)
# Each function returns a dictionary of errors. Empty dictionary = all good.
# ---------------------------------------------------------------
def validate_client(data, client_id=0):
    errors = {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    phone = data.get("phone", "").strip()

    if len(name) < 2:
        errors["name"] = "Enter a name with at least 2 characters."

    if not re.match(EMAIL_PATTERN, email):
        errors["email"] = "Enter a valid email, like name@company.com."
    else:
        # Is this email already used by a DIFFERENT client?
        same = fetch_one("SELECT id FROM clients WHERE email = ? AND id != ?", (email, client_id))
        if same:
            errors["email"] = "A client with this email already exists."

    if phone and not re.match(PHONE_PATTERN, phone):
        errors["phone"] = "Use 7 to 19 digits. Spaces, dashes and + are fine."
    return errors


def validate_activity(data):
    errors = {}
    if len(data.get("title", "").strip()) < 3:
        errors["title"] = "Enter a title with at least 3 characters."
    if data.get("status", "Pending") not in STATUSES:
        errors["status"] = "Status must be Pending, In Progress or Completed."
    due = data.get("due_date", "")
    if due:
        try:
            datetime.strptime(due, "%Y-%m-%d")
        except ValueError:
            errors["due_date"] = "Use a valid date."
    return errors


def bad_request(errors):
    return jsonify({"errors": errors}), 400


def not_found(what):
    return jsonify({"error": what + " not found"}), 404


# ---------------------------------------------------------------
# CLIENT ROUTES
# ---------------------------------------------------------------
@app.get("/api/clients")
def list_clients():
    """All clients (optionally filtered by ?q=text) + how many activities per status."""
    q = "%" + request.args.get("q", "").strip() + "%"
    # ONE query does everything: LEFT JOIN + GROUP BY counts activities per client.
    # (Doing a separate query per client would be slow = the "N+1 problem".)
    sql = """
        SELECT c.*,
               COALESCE(SUM(a.status = 'Pending'), 0)     AS pending,
               COALESCE(SUM(a.status = 'In Progress'), 0) AS in_progress,
               COALESCE(SUM(a.status = 'Completed'), 0)   AS completed
        FROM clients c
        LEFT JOIN activities a ON a.client_id = c.id
        WHERE c.name LIKE ? OR c.email LIKE ? OR c.company LIKE ?
        GROUP BY c.id
        ORDER BY c.id
    """
    return jsonify(fetch_all(sql, (q, q, q)))


@app.get("/api/clients/<int:client_id>")
def get_client(client_id):
    client = fetch_one("SELECT * FROM clients WHERE id = ?", (client_id,))
    return jsonify(client) if client else not_found("Client")


@app.post("/api/clients")
def create_client():
    data = request.get_json(silent=True) or {}
    errors = validate_client(data)
    if errors:
        return bad_request(errors)
    try:
        new_id = run("INSERT INTO clients (name, email, phone, company) VALUES (?,?,?,?)",
                     (data["name"].strip(), data["email"].strip(),
                      data.get("phone", "").strip(), data.get("company", "").strip()))
    except sqlite3.IntegrityError:
        # Safety net: two people saving the same email at the same moment.
        return bad_request({"email": "A client with this email already exists."})
    return jsonify(fetch_one("SELECT * FROM clients WHERE id = ?", (new_id,))), 201


@app.put("/api/clients/<int:client_id>")
def update_client(client_id):
    if not fetch_one("SELECT id FROM clients WHERE id = ?", (client_id,)):
        return not_found("Client")
    data = request.get_json(silent=True) or {}
    errors = validate_client(data, client_id)
    if errors:
        return bad_request(errors)
    try:
        run("UPDATE clients SET name = ?, email = ?, phone = ?, company = ? WHERE id = ?",
            (data["name"].strip(), data["email"].strip(),
             data.get("phone", "").strip(), data.get("company", "").strip(), client_id))
    except sqlite3.IntegrityError:
        return bad_request({"email": "A client with this email already exists."})
    return jsonify(fetch_one("SELECT * FROM clients WHERE id = ?", (client_id,)))


@app.delete("/api/clients/<int:client_id>")
def delete_client(client_id):
    if not fetch_one("SELECT id FROM clients WHERE id = ?", (client_id,)):
        return not_found("Client")
    run("DELETE FROM clients WHERE id = ?", (client_id,))  # CASCADE removes their activities
    return jsonify({"deleted": True})


# ---------------------------------------------------------------
# ACTIVITY ROUTES
# ---------------------------------------------------------------
@app.get("/api/clients/<int:client_id>/activities")
def list_activities(client_id):
    """Activities of one client. Optional filter: ?status=Pending"""
    status = request.args.get("status", "All")
    if status == "All":
        rows = fetch_all("SELECT * FROM activities WHERE client_id = ? ORDER BY id", (client_id,))
    else:
        rows = fetch_all("SELECT * FROM activities WHERE client_id = ? AND status = ? ORDER BY id",
                         (client_id, status))
    return jsonify(rows)


@app.post("/api/clients/<int:client_id>/activities")
def create_activity(client_id):
    if not fetch_one("SELECT id FROM clients WHERE id = ?", (client_id,)):
        return not_found("Client")
    data = request.get_json(silent=True) or {}
    errors = validate_activity(data)
    if errors:
        return bad_request(errors)
    new_id = run("""INSERT INTO activities (client_id, title, description, status, due_date)
                    VALUES (?,?,?,?,?)""",
                 (client_id, data["title"].strip(), data.get("description", "").strip(),
                  data.get("status", "Pending"), data.get("due_date", "")))
    return jsonify(fetch_one("SELECT * FROM activities WHERE id = ?", (new_id,))), 201


@app.put("/api/activities/<int:activity_id>")
def update_activity(activity_id):
    if not fetch_one("SELECT id FROM activities WHERE id = ?", (activity_id,)):
        return not_found("Activity")
    data = request.get_json(silent=True) or {}
    errors = validate_activity(data)
    if errors:
        return bad_request(errors)
    run("""UPDATE activities SET title = ?, description = ?, status = ?, due_date = ?
           WHERE id = ?""",
        (data["title"].strip(), data.get("description", "").strip(),
         data.get("status", "Pending"), data.get("due_date", ""), activity_id))
    return jsonify(fetch_one("SELECT * FROM activities WHERE id = ?", (activity_id,)))


@app.patch("/api/activities/<int:activity_id>/status")
def change_status(activity_id):
    """Quick status change from the dropdown on each activity card."""
    data = request.get_json(silent=True) or {}
    if data.get("status") not in STATUSES:
        return bad_request({"status": "Status must be Pending, In Progress or Completed."})
    if not fetch_one("SELECT id FROM activities WHERE id = ?", (activity_id,)):
        return not_found("Activity")
    run("UPDATE activities SET status = ? WHERE id = ?", (data["status"], activity_id))
    return jsonify(fetch_one("SELECT * FROM activities WHERE id = ?", (activity_id,)))


@app.delete("/api/activities/<int:activity_id>")
def delete_activity(activity_id):
    if not fetch_one("SELECT id FROM activities WHERE id = ?", (activity_id,)):
        return not_found("Activity")
    run("DELETE FROM activities WHERE id = ?", (activity_id,))
    return jsonify({"deleted": True})


# ---------------------------------------------------------------
# Serve the frontend page so one command starts everything
# ---------------------------------------------------------------
@app.get("/")
def home():
    return send_from_directory(FRONTEND_DIR, "index.html")


if __name__ == "__main__":
    init_db()
    app.run(debug=True,host="0.0.0.0", port=5000)
