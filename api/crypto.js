import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_ENV = "PAYMENT_ENCRYPTION_KEY";

function getKey() {
  const raw = process.env[KEY_ENV];
  if (!raw || raw.length !== 64) {
    throw new Error(
      `${KEY_ENV} must be set to a 64-char hex string (32 bytes). ` +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return Buffer.from(raw, "hex");
}

/**
 * Encrypts a plaintext string with AES-256-GCM.
 * Returns a colon-separated string: iv:authTag:ciphertext (all hex).
 */
export function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

/**
 * Decrypts a value produced by encrypt().
 */
export function decrypt(ciphertext) {
  const [ivHex, authTagHex, dataHex] = ciphertext.split(":");
  if (!ivHex || !authTagHex || !dataHex) throw new Error("Invalid ciphertext format");
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
