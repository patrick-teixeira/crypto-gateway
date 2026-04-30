import { setTimeout as sleep } from "node:timers/promises";

export async function sendWebhook(
  webhookUrl,
  paymentData,
  message = null,
  maxRetries = 3,
) {
  if (!webhookUrl) {
    console.warn("Webhook URL não configurada para este pagamento");
    return false;
  }

  const payload = {
    payment_id: paymentData?.id,
    address: paymentData?.address,
    amount: paymentData?.amount,
    status: paymentData?.status,
    validated_at: paymentData?.validated_at,
    message,
  };

  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "CryptoGateway-Webhook/1.0",
  };

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      console.info(
        `Sending webhook to ${webhookUrl} (attempt ${attempt}/${maxRetries})`,
      );

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if ([200, 201, 204].includes(response.status)) {
        console.info(`Webhook sent successfully: ${webhookUrl}`);
        return true;
      }

      const responseText = await response.text();
      console.warn(
        `Webhook returned status ${response.status}: ${responseText}`,
      );
    } catch (error) {
      console.error(
        `Error sending webhook (attempt ${attempt}/${maxRetries}): ${String(error)}`,
      );
    }

    if (attempt < maxRetries) {
      await sleep(2 ** attempt * 1000);
    }
  }

  console.error(`Failed to send webhook after ${maxRetries} attempts`);
  return false;
}

export function sendWebhookAsync(webhookUrl, paymentData, message = null) {
  setImmediate(() => {
    sendWebhook(webhookUrl, paymentData, message).catch((error) => {
      console.error(`Unexpected webhook async error: ${String(error)}`);
    });
  });
}
