"""
database.py
All the database helper code lives here, so app.py stays clean.
Used Python's built-in sqlite3 module (nothing to install).
"""
import os
import sqlite3
from datetime import date, timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "client_activity.db")
SCHEMA_PATH = os.path.join(BASE_DIR, "schema.sql")


def get_connection():
    """Open a connection to the database file."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row            # rows behave like dictionaries: row["name"]
    conn.execute("PRAGMA foreign_keys = ON")  # SQLite ignores foreign keys unless we ask
    return conn


def fetch_all(sql, params=()):
    """Run a SELECT and return a list of dictionaries."""
    conn = get_connection()
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def fetch_one(sql, params=()):
    """Run a SELECT and return ONE dictionary (or None if nothing found)."""
    rows = fetch_all(sql, params)
    return rows[0] if rows else None


def run(sql, params=()):
    """Run an INSERT / UPDATE / DELETE. Returns the new row id (for inserts)."""
    conn = get_connection()
    try:
        cursor = conn.execute(sql, params)
        conn.commit()                  # save the change permanently
        return cursor.lastrowid
    finally:
        conn.close()                   # always close, even if there was an error


def init_db():
    """Create tables (from schema.sql) and add demo data if the database is empty."""
    conn = get_connection()
    with open(SCHEMA_PATH) as f:
        conn.executescript(f.read())
    conn.commit()
    conn.close()

    if fetch_one("SELECT COUNT(*) AS total FROM clients")["total"] == 0:
        seed_demo_data()


def day(offset):
    """Return a date string like '2026-10-22', `offset` days from today."""
    return (date.today() + timedelta(days=offset)).isoformat()


def seed_demo_data():
    """Same demo data as the original HTML demo."""
    run("INSERT INTO clients (name, email, phone, company) VALUES (?,?,?,?)",
        ("Rahim Uddin", "rahim@brightlabs.io", "+880 1711 223344", "Bright Labs"))
    run("INSERT INTO clients (name, email, phone, company) VALUES (?,?,?,?)",
        ("Nadia Karim", "nadia@greenleaf.com", "+880 1819 556677", "GreenLeaf Foods"))

    sql = "INSERT INTO activities (client_id, title, description, status, due_date) VALUES (?,?,?,?,?)"
    run(sql, (1, "Kickoff call", "Confirm scope and timeline.", "Completed", day(-3)))
    run(sql, (1, "Send proposal", "Include pricing options.", "In Progress", day(2)))
    run(sql, (1, "Collect brand assets", "", "Pending", day(7)))
    run(sql, (2, "Quarterly review", "Prepare report slides.", "Pending", day(5)))
    run(sql, (2, "Contract renewal", "Follow up with legal.", "In Progress", day(10)))
