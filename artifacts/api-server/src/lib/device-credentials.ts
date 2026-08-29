import crypto from "node:crypto";
import { HttpError } from "./http";

const PREFIX = "enc:v1:";

function key(): Buffer {
  const secret = process.env.DEVICE_CREDENTIAL_KEY || process.env.SESSION_SECRET;
  if (!secret) throw new HttpError(503, "Device credential storage is not configured.", "CREDENTIAL_STORAGE_UNAVAILABLE");
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptDeviceCredential(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${PREFIX}${iv.toString("base64")}.${ciphertext.toString("base64")}.${cipher.getAuthTag().toString("base64")}`;
}

export function decryptDeviceCredential(value: string): string {
  if (!value.startsWith(PREFIX)) throw new HttpError(409, "This credential cannot be revealed securely.", "CREDENTIAL_LEGACY_VALUE");
  const [ivValue, ciphertextValue, tagValue, ...extra] = value.slice(PREFIX.length).split(".");
  if (extra.length || !ivValue || !ciphertextValue || !tagValue) throw new HttpError(409, "This credential cannot be revealed securely.", "CREDENTIAL_INVALID");
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivValue, "base64"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64")), decipher.final()]).toString("utf8");
  } catch {
    throw new HttpError(409, "This credential cannot be revealed securely.", "CREDENTIAL_INVALID");
  }
}