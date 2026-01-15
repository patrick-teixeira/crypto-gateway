import requests
import logging
from typing import Optional, Dict, Any
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def send_webhook(webhook_url, payment_data, message = None, max_retries= 3) -> bool:
    if not webhook_url:
        logger.warning("Webhook URL não configurada para este pagamento")
        return False
    
    payload = {
        'payment_id': payment_data.get('id'),
        'address': payment_data.get('address'),
        'amount': payment_data.get('amount'),
        'status': payment_data.get('status'),
        'validated_at': payment_data.get('validated_at'),
        'message': message
    }
    
    headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'CryptoGateway-Webhook/1.0'
    }
    
    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"Sending webhook to {webhook_url} (attempt {attempt}/{max_retries})")
            response = requests.post(
                webhook_url,
                json=payload,
                headers=headers,
                timeout=10
            )
            
            if response.status_code in [200, 201, 204]:
                logger.info(f"Webhook sent successfully: {webhook_url}")
                return True
            else:
                logger.warning(f"Webhook returned status {response.status_code}: {response.text}")
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Error sending webhook (attempt {attempt}/{max_retries}): {str(e)}")
            
        if attempt < max_retries:
            
            time.sleep(2 ** attempt) 
    
    logger.error(f"Failed to send webhook after {max_retries} attempts")
    return False

def send_webhook_async(webhook_url: str, payment_data: Dict[str, Any]) -> None:
    import threading
    
    thread = threading.Thread(
        target=send_webhook,
        args=(webhook_url, payment_data),
        daemon=True
    )
    thread.start()