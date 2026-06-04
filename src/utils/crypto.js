/**
 * AES-256-GCM Encryption Module
 *
 * Provides authenticated encryption using the Web Crypto API.
 * Replaces the old XOR cipher with industry-standard AES-256-GCM.
 *
 * Key derivation: PBKDF2 (310,000 iterations) + SHA-256
 * Binary layout:  salt(16 bytes) + iv(12 bytes) + ciphertext (includes GCM auth tag)
 *
 * All functions work in both the main thread and Web Workers.
 */

const PBKDF2_ITERATIONS = 310_000; // OWASP 2023 recommendation for SHA-256
const SALT_LENGTH = 16;            // bytes
const IV_LENGTH   = 12;            // bytes — GCM standard nonce size
const KEY_LENGTH  = 256;           // bits

/**
 * AES overhead in bytes: salt + IV + GCM auth tag (16 bytes) + 1 flag byte
 */
export const AES_OVERHEAD = SALT_LENGTH + IV_LENGTH + 16 + 1;

/**
 * Derives a CryptoKey from a user password using PBKDF2 + SHA-256.
 * @param {string} password
 * @param {Uint8Array} salt — 16 random bytes
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts plaintext bytes with AES-256-GCM.
 * @param {Uint8Array} plaintextBytes — raw bytes to encrypt
 * @param {string} password
 * @returns {Promise<Uint8Array>} — binary layout: [salt(16)] + [iv(12)] + [ciphertext + auth tag]
 */
export async function aesEncrypt(plaintextBytes, password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv   = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key  = await deriveKey(password, salt);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintextBytes
  );

  // Pack: salt | iv | ciphertext (which includes the 16-byte GCM auth tag)
  const cipher = new Uint8Array(cipherBuffer);
  const out = new Uint8Array(SALT_LENGTH + IV_LENGTH + cipher.byteLength);
  out.set(salt,   0);
  out.set(iv,     SALT_LENGTH);
  out.set(cipher, SALT_LENGTH + IV_LENGTH);
  return out;
}

/**
 * Decrypts a payload produced by aesEncrypt.
 * @param {Uint8Array} payload — the combined salt + iv + ciphertext bytes
 * @param {string} password
 * @returns {Promise<Uint8Array>} — original plaintext bytes
 * @throws {DOMException} OperationError if password is wrong or data is corrupted
 */
export async function aesDecrypt(payload, password) {
  const salt   = payload.slice(0, SALT_LENGTH);
  const iv     = payload.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const cipher = payload.slice(SALT_LENGTH + IV_LENGTH);

  const key = await deriveKey(password, salt);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipher
  );
  return new Uint8Array(plainBuffer);
}

// ─── Bit/Byte conversion helpers ─────────────────────────────────────────────

/**
 * Converts a Uint8Array to a bit array (MSB first per byte).
 * @param {Uint8Array} bytes
 * @returns {number[]} array of 0s and 1s
 */
export function bytesToBits(bytes) {
  const bits = [];
  for (const byte of bytes) {
    for (let i = 7; i >= 0; i--) {
      bits.push((byte >> i) & 1);
    }
  }
  return bits;
}

/**
 * Converts a bit array back to a Uint8Array.
 * @param {number[]} bits — array of 0s and 1s (length must be a multiple of 8)
 * @returns {Uint8Array}
 */
export function bitsToBytes(bits) {
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | (bits[i * 8 + j] || 0);
    }
    bytes[i] = byte;
  }
  return bytes;
}
