import os
import time
import signal
import sqlite3
from decimal import Decimal
from web3 import Web3

DB_PATH = "data/payments.db"
w3 = Web3(Web3.HTTPProvider("https://api.roninchain.com/rpc"))

def get_peding_payments():
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row  # rows com acesso por nome
        cur = conn.cursor()
        cur.execute("SELECT * FROM payments WHERE status = 'waiting-payment'")
        rows = [dict(row) for row in cur.fetchall()]  # vira lista de dicts
    return rows

def update_payment_status(id: int, new_status: str):
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE payments SET status = ? WHERE id = ?",
            (new_status, id)
        )
        conn.commit()

def validate_payments():
    pending_payments = get_peding_payments()
    for payment in pending_payments:
        address = payment['address']
        amount = payment['amount']
        id = payment['id']
        wallet_balance = get_usdc_balance(address)
        print(f'{address} balance: {wallet_balance}')
        if wallet_balance >= amount:
            update_payment_status(id, 'paid')
            print('payment validated')
        
def get_usdc_balance(address: str) -> float:
    ERC20_ABI = [
        {
            "constant": True,
            "inputs": [{"name": "_owner", "type": "address"}],
            "name": "balanceOf",
            "outputs": [{"name": "balance", "type": "uint256"}],
            "type": "function",
        },
        {
            "constant": True,
            "inputs": [],
            "name": "decimals",
            "outputs": [{"name": "", "type": "uint8"}],
            "type": "function",
        },
    ]

    if not w3.is_address(address):
        raise ValueError("Endereço inválido")

    checksum_address = w3.to_checksum_address(address)
    usdc_address = w3.to_checksum_address('0x0b7007c13325c48911f73a2dad5fa5dcbf808adc')

    contract = w3.eth.contract(address=usdc_address, abi=ERC20_ABI)

    raw_balance = contract.functions.balanceOf(checksum_address).call()
    decimals = contract.functions.decimals().call()

    balance = raw_balance / (10 ** decimals)
    return float(balance)

if __name__ == '__main__':
    validate_payments()