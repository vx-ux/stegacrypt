

const PBKDF2_ITERATIONS = 310_000; // OWASP 2023 recommendation for SHA-256
const SALT_LENGTH = 16;            // bytes
const IV_LENGTH   = 12;            // bytes - GCM standard nonce size
const KEY_LENGTH  = 256;           // bits


export const AES_OVERHEAD = SALT_LENGTH + IV_LENGTH + 16 + 1;


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



export function bytesToBits(bytes) {
  const bits = [];
  for (const byte of bytes) {
    for (let i = 7; i >= 0; i--) {
      bits.push((byte >> i) & 1);
    }
  }
  return bits;
}


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
