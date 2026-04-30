from flask import Blueprint, jsonify, request
import hashlib
import os
import secrets
import sqlite3
import time

auth_app = Blueprint("auth", __name__, url_prefix="/auth")

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "payments.db")


def init_auth_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                password_salt TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS api_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                api_key TEXT NOT NULL UNIQUE,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS auth_tokens (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
            """
        )


def hash_password(password: str, salt_hex: str) -> str:
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt_hex),
        100_000,
    )
    return password_hash.hex()


def is_valid_email(email: str) -> bool:
    return "@" in email and "." in email


def get_user_id_from_bearer_token() -> int | None:
    auth_header = request.headers.get("Authorization") or ""
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header.removeprefix("Bearer ").strip()
    if not token:
        return None

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT user_id FROM auth_tokens WHERE token = ?",
            (token,),
        ).fetchone()
        if row is None:
            return None
        return int(row["user_id"])


init_auth_db()


@auth_app.route("/register", methods=["OPTIONS"])
@auth_app.route("/login", methods=["OPTIONS"])
@auth_app.route("/api-keys", methods=["OPTIONS"])
@auth_app.route("/api-keys/list", methods=["OPTIONS"])
def auth_options():
    return ("", 204)


@auth_app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    if not is_valid_email(email):
        return jsonify({"error": "invalid email"}), 400

    if len(password) < 6:
        return jsonify({"error": "password must be at least 6 characters"}), 400

    salt = secrets.token_hex(16)
    password_hash = hash_password(password, salt)

    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                "INSERT INTO users (email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?)",
                (email, password_hash, salt, int(time.time())),
            )
            conn.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "email already registered"}), 409

    return jsonify({"message": "registration successful"}), 201


@auth_app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        user = conn.execute(
            "SELECT id, email, password_hash, password_salt FROM users WHERE email = ?",
            (email,),
        ).fetchone()

    if user is None:
        return jsonify({"error": "invalid credentials"}), 401

    expected_hash = hash_password(password, user["password_salt"])
    if not secrets.compare_digest(expected_hash, user["password_hash"]):
        return jsonify({"error": "invalid credentials"}), 401

    token = secrets.token_hex(24)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "INSERT OR REPLACE INTO auth_tokens (token, user_id, created_at) VALUES (?, ?, ?)",
            (token, int(user["id"]), int(time.time())),
        )
        conn.commit()

    return jsonify(
        {
            "message": "login successful",
            "token": token,
            "user": {"id": user["id"], "email": user["email"]},
        }
    ), 200


@auth_app.route("/api-keys", methods=["POST"])
def create_api_key():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()

    if not name:
        return jsonify({"error": "name is required"}), 400

    user_id = get_user_id_from_bearer_token()
    if user_id is None:
        return jsonify({"error": "invalid or missing token"}), 401

    api_key = secrets.token_hex(24)

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        user = conn.execute("SELECT id FROM users WHERE id = ?", (user_id,)).fetchone()
        if user is None:
            return jsonify({"error": "user not found"}), 404

        conn.execute(
            "INSERT INTO api_keys (user_id, name, api_key, created_at) VALUES (?, ?, ?, ?)",
            (user_id, name, api_key, int(time.time())),
        )
        conn.commit()

    return jsonify({"message": "api key created", "name": name, "api_key": api_key}), 201


@auth_app.route("/api-keys/list", methods=["GET"])
def list_api_keys():
    user_id = get_user_id_from_bearer_token()
    if user_id is None:
        return jsonify({"error": "invalid or missing token"}), 401

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT id, name, api_key, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()

    return jsonify(
        {
            "api_keys": [
                {
                    "id": row["id"],
                    "name": row["name"],
                    "api_key": row["api_key"],
                    "created_at": row["created_at"],
                }
                for row in rows
            ]
        }
    ), 200
