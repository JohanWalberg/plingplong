import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Secrets stored in JSON columns (a source's API key) are encrypted at rest
 * with AES-256-GCM. The key is SOURCE_SECRET_KEY, or the auth secret when
 * that is not set, hashed to 32 bytes. Values that are not in the encrypted
 * format are returned as they are, so rows written before this existed keep
 * working until scripts/encrypt-source-keys.ts has run.
 */
const PREFIX = "enc1:";

function key(): Buffer {
  const material = process.env.SOURCE_SECRET_KEY || process.env.BETTER_AUTH_SECRET || "development-only";
  return createHash("sha256").update(material).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${PREFIX}${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ct.toString("base64url")}`;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function decryptSecret(value: string): string {
  if (!isEncrypted(value)) return value;
  const [iv, tag, ct] = value.slice(PREFIX.length).split(".");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

/** A source config with its API key readable, for the worker and the connection test. */
export function withPlainApiKey<T extends { apiKey?: string; [key: string]: unknown }>(config: T): T {
  return config.apiKey ? { ...config, apiKey: decryptSecret(config.apiKey) } : config;
}
