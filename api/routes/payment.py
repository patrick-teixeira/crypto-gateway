from flask import Blueprint, request, jsonify
import os
import sqlite3
from eth_account import Account
import time

payment_app = Blueprint('payment', __name__)

# DB em data/payments.db na raiz do projeto
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DATA_DIR = os.path.join(BASE_DIR, 'data')
DB_PATH = os.path.join(DATA_DIR, 'payments.db')

def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                address TEXT NOT NULL,
                private_key TEXT NOT NULL,
                amount NUMERIC NOT NULL,
                status TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
        """)

def ensure_status_column():
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(payments)")
        cols = [r[1] for r in cur.fetchall()]
        if 'status' not in cols:
            cur.execute("ALTER TABLE payments ADD COLUMN status TEXT NOT NULL DEFAULT 'waiting-payment'")
            conn.commit()

init_db()
ensure_status_column()

@payment_app.route('/create_payment', methods=['POST'])
def create_payment():
    data = request.get_json(silent=True) or {}
    amount = data.get('amount') or data.get('valor')

    try:
        amount = float(amount)
    except (TypeError, ValueError):
        return jsonify({'error': 'amount is required and must be a number'}), 400

    if amount <= 0:
        return jsonify({'error': 'amount must be greater than 0'}), 400

    # Cria wallet Ethereum
    acct = Account.create()
    address = acct.address
    private_key_hex = acct.key.hex()

    # Persiste no SQLite
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO payments (address, private_key, amount, status, created_at) VALUES (?, ?, ?, ?, ?)",
            (address, private_key_hex, amount, 'waiting-payment', int(time.time()))
        )
        payment_id = cur.lastrowid
        conn.commit()

    # Não retornamos a private key na resposta
    return jsonify({
        'message': 'Payment created',
        'payment_id': payment_id,
        'address': address
    }), 200