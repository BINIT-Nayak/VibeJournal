import "server-only";

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const cost = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
export const dummyPasswordHash = `scrypt$131072$8$1$${"0".repeat(32)}$${"0".repeat(128)}`;

function derive(password: string, salt: string, legacy = false): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, legacy ? { ...cost, N: 16384 } : cost, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt);
  return `scrypt$131072$8$1$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const legacy = !storedHash.startsWith("scrypt$");
  const parts = legacy ? storedHash.split(":") : storedHash.split("$");
  if (!legacy && (parts.length !== 6 || parts.slice(0, 4).join("$") !== "scrypt$131072$8$1")) {
    return false;
  }
  if (legacy && parts.length !== 2) return false;
  const salt = parts[legacy ? 0 : 4];
  const key = parts[legacy ? 1 : 5];
  if (!/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(key)) return false;
  return timingSafeEqual(Buffer.from(key, "hex"), await derive(password, salt, legacy));
}
