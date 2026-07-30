import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function parseKey(keyHex: string): Buffer {
  if (!/^[a-fA-F0-9]{64}$/.test(keyHex)) {
    throw new Error("Encryption key must contain exactly 64 hexadecimal characters");
  }
  return Buffer.from(keyHex, "hex");
}

export function encryptValue(plainText: string, keyHex: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", parseKey(keyHex), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(
    ":"
  );
}

export function decryptValue(payload: string, keyHex: string): string {
  const [version, ivEncoded, tagEncoded, encryptedEncoded] = payload.split(":");
  if (version !== "v1" || !ivEncoded || !tagEncoded || !encryptedEncoded) {
    throw new Error("Encrypted value has an invalid format");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    parseKey(keyHex),
    Buffer.from(ivEncoded, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedEncoded, "base64url")),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}
