import "server-only"

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"

// AES-256-GCM encryption for secrets at rest (e.g. Square OAuth tokens).
// The 32-byte key is derived from BETTER_AUTH_SECRET so no extra secret is
// required. Output format: base64( iv(12) | authTag(16) | ciphertext ).

function getKey(): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is not set; cannot encrypt/decrypt secrets.")
  }
  // SHA-256 yields a deterministic 32-byte key regardless of secret length.
  return createHash("sha256").update(secret).digest()
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString("base64")
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64")
  const iv = buf.subarray(0, 12)
  const authTag = buf.subarray(12, 28)
  const ciphertext = buf.subarray(28)
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
}
