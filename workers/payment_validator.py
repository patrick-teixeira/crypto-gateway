import os
import time
import signal
import sqlite3
from decimal import Decimal
from web3 import Web3
from time import sleep
import sys
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, BASE_DIR)
from api import webhook

DB_PATH = "data/payments.db"



class Validator:
    def __init__(self, rpc_url):
        self.rpc_url = rpc_url
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))

    def get_peding_payments(self):
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row  # rows com acesso por nome
            cur = conn.cursor()
            cur.execute("SELECT * FROM payments WHERE status = 'waiting-payment'")
            rows = [dict(row) for row in cur.fetchall()]  # vira lista de dicts
        return rows

    def update_payment_status(self, id: int, new_status: str):
        with sqlite3.connect(DB_PATH) as conn:
            cur = conn.cursor()
            cur.execute(
                "UPDATE payments SET status = ? WHERE id = ?",
                (new_status, id)
            )
            conn.commit()

    def validate_payments(self):
        pending_payments = self.get_peding_payments()
        for payment in pending_payments:
            if payment['created_at'] + 3600 >= int(time.time()):
                address = payment['address']
                amount = payment['amount']
                id = payment['id']
                webhook_url = payment['webhook_url']
                wallet_balance = self.get_usdc_balance(address)
                print(f'{address} balance: {wallet_balance}')
                if wallet_balance >= amount:
                    self.update_payment_status(id, 'paid')
                    payment['validated_at'] = int(time.time())
                    webhook.send_webhook_async(webhook_url, payment)
                    print('payment validated')
            
    def get_token_balance(self, address: str, token_address: str) -> float:
        
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

        checksum_address = self.w3.to_checksum_address(address)
        checksum_contract = self.w3.to_checksum_address(token_address)

        contract = self.w3.eth.contract(address=checksum_contract, abi=ERC20_ABI)

        raw_balance = contract.functions.balanceOf(checksum_address).call()
        decimals = contract.functions.decimals().call()

        balance = raw_balance / (10 ** decimals)
        return float(balance)

if __name__ == '__main__':
    validator = Validator(os.environ["RONIN_RPC_URL"])
    print(validator.get_token_balance('0x649f307809b4917d39Fe355FE9E1922260C07b98','0xc99a6a985ed2cac1ef41640596c5a5f9f4e19ef5'))
