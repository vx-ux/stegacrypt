/**
 * LSB Image Steganography — v2
 *
 * Hides data in the Least Significant Bits of image pixel channels.
 *
 * v2 changes:
 * - AES-256-GCM encryption replaces XOR cipher
 * - New "STC2" magic header for v2 format
 * - UTF-8 encoding via TextEncoder (fixes Unicode/emoji corruption)
 * - Backward-compatible: decode() falls back to legacy "STCR" (v1 XOR) format
 */

import { aesEncrypt, aesDecrypt, bytesToBits, bitsToBytes, AES_OVERHEAD } from './crypto.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAGIC_V2 = 'STC2';        // v2 magic header (AES-256-GCM)
const MAGIC_V1 = 'STCR';        // v1 magic header (legacy XOR) — decode-only
const MAGIC_LENGTH = 4;          // bytes
const LENGTH_BITS = 32;          // 32-bit payload byte length field
const FLAG_PLAIN     = 0x00;
const FLAG_ENCRYPTED = 0x01;

// ─── Legacy helpers (kept for v1 backward compatibility in decode) ────────────

function xorCipher(text, password) {
  if (!password) return text;
  const result = [];
  for (let i = 0; i < text.length; i++) {
    result.push(text.charCodeAt(i) ^ password.charCodeAt(i % password.length));
  }
  return String.fromCharCode(...result);
}

function stringToBits(str) {
  const bits = [];
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    for (let bit = 7; bit >= 0; bit--) {
      bits.push((charCode >> bit) & 1);
    }
  }
  return bits;
}

function bitsToString(bits) {
  const chars = [];
  for (let i = 0; i < bits.length; i += 8) {
    let charCode = 0;
    for (let bit = 0; bit < 8; bit++) {
      charCode = (charCode << 1) | (bits[i + bit] || 0);
    }
    chars.push(String.fromCharCode(charCode));
  }
  return chars.join('');
}

function numberToBits(num, length) {
  const bits = [];
  for (let i = length - 1; i >= 0; i--) {
    bits.push((num >> i) & 1);
  }
  return bits;
}

function bitsToNumber(bits) {
  let num = 0;
  for (const bit of bits) {
    num = (num << 1) | bit;
  }
  return num;
}

// ─── Capacity ────────────────────────────────────────────────────────────────

/**
 * Calculate the maximum number of characters that can be encoded.
 * @param {ImageData} imageData - The image data
 * @param {number} bitsPerChannel - Bits per channel (1, 2, or 4)
 * @param {boolean} encrypted - Whether AES encryption will be used
 * @returns {number} Maximum characters (approximate for encrypted, since UTF-8
 *                   encoding may use more than 1 byte per character)
 */
export function getCapacity(imageData, bitsPerChannel = 1, encrypted = false) {
  const totalPixels = imageData.width * imageData.height;
  const totalBits = totalPixels * 3 * bitsPerChannel;
  // Header: magic(4 bytes) + length(4 bytes) = 64 bits
  const headerBits = (MAGIC_LENGTH * 8) + LENGTH_BITS;
  const availableBits = totalBits - headerBits;
  let availableBytes = Math.floor(availableBits / 8);

  if (encrypted) {
    // Subtract AES overhead (salt + IV + auth tag + flag byte)
    availableBytes -= AES_OVERHEAD;
  } else {
    // Subtract 1 byte for the plain flag
    availableBytes -= 1;
  }

  return Math.max(0, availableBytes);
}

// ─── Encode (v2) ─────────────────────────────────────────────────────────────

/**
 * Encode a message into image data using LSB steganography (v2 format).
 * Uses AES-256-GCM when a password is provided, UTF-8 for text encoding.
 *
 * Wire format: MAGIC("STC2", 4B) + PAYLOAD_LENGTH(4B big-endian) + FLAG(1B) + PAYLOAD
 *
 * @param {ImageData} imageData - The original image data (will be modified in place)
 * @param {string} message - The message to encode
 * @param {number} bitsPerChannel - Bits per channel to use (1, 2, or 4)
 * @param {string} password - Optional password for AES-256-GCM encryption
 * @returns {Promise<ImageData>} The modified image data with embedded message
 */
export async function encode(imageData, message, bitsPerChannel = 1, password = '') {
  // Build payload bytes: FLAG + content
  let payloadBytes;
  const messageBytes = new TextEncoder().encode(message);

  if (password) {
    const encrypted = await aesEncrypt(messageBytes, password);
    payloadBytes = new Uint8Array(1 + encrypted.byteLength);
    payloadBytes[0] = FLAG_ENCRYPTED;
    payloadBytes.set(encrypted, 1);
  } else {
    payloadBytes = new Uint8Array(1 + messageBytes.byteLength);
    payloadBytes[0] = FLAG_PLAIN;
    payloadBytes.set(messageBytes, 1);
  }

  // Check capacity
  const capacity = getCapacity(imageData, bitsPerChannel, !!password);
  if (messageBytes.byteLength > capacity) {
    throw new Error(`Message too long. Maximum ~${capacity} characters for this image at ${bitsPerChannel} bits/channel.`);
  }

  // Build bit stream: MAGIC("STC2") + LENGTH(32-bit, payload byte count) + PAYLOAD
  const magicBits  = stringToBits(MAGIC_V2);
  const lengthBits = numberToBits(payloadBytes.byteLength, LENGTH_BITS);
  const dataBits   = bytesToBits(payloadBytes);
  const allBits    = [...magicBits, ...lengthBits, ...dataBits];

  // Embed bits into pixel channels
  const data = imageData.data;
  let bitIndex = 0;
  const mask = 0xFF << bitsPerChannel;

  for (let i = 0; i < data.length && bitIndex < allBits.length; i++) {
    if ((i + 1) % 4 === 0) continue; // Skip alpha

    let value = 0;
    for (let b = bitsPerChannel - 1; b >= 0; b--) {
      if (bitIndex < allBits.length) {
        value |= allBits[bitIndex] << b;
        bitIndex++;
      }
    }

    data[i] = (data[i] & mask) | value;
  }

  return imageData;
}

// ─── Decode (v2 with v1 fallback) ────────────────────────────────────────────

/**
 * Decode a hidden message from image data.
 * Supports both v2 (STC2 / AES-256-GCM) and v1 (STCR / XOR) formats.
 *
 * @param {ImageData} imageData - The image data with hidden message
 * @param {number} bitsPerChannel - Bits per channel used during encoding
 * @param {string} password - Password for decryption (if used during encoding)
 * @returns {Promise<string>} The decoded message
 */
export async function decode(imageData, bitsPerChannel = 1, password = '') {
  const data = imageData.data;
  const allBits = [];
  const lsbMask = (1 << bitsPerChannel) - 1;

  // Extract all LSBs
  for (let i = 0; i < data.length; i++) {
    if ((i + 1) % 4 === 0) continue;
    const value = data[i] & lsbMask;
    for (let b = bitsPerChannel - 1; b >= 0; b--) {
      allBits.push((value >> b) & 1);
    }
  }

  // Read magic header (4 bytes = 32 bits)
  const magicBits = allBits.slice(0, MAGIC_LENGTH * 8);
  const magic = bitsToString(magicBits);

  if (magic === MAGIC_V2) {
    return decodeV2(allBits, password);
  } else if (magic === MAGIC_V1) {
    return decodeLegacyV1(allBits, password);
  } else {
    throw new Error('No hidden message found in this image (invalid header).');
  }
}

/**
 * Decode v2 format: STC2 + LENGTH(4B) + FLAG(1B) + PAYLOAD
 */
async function decodeV2(allBits, password) {
  const headerStart = MAGIC_LENGTH * 8;

  // Read payload byte length (32 bits)
  const lengthBits = allBits.slice(headerStart, headerStart + LENGTH_BITS);
  const payloadLength = bitsToNumber(lengthBits);

  if (payloadLength <= 0 || payloadLength > 10_000_000) {
    throw new Error('Invalid message length detected. The image may not contain a valid hidden message.');
  }

  // Read payload bytes
  const payloadStart = headerStart + LENGTH_BITS;
  const payloadBits = allBits.slice(payloadStart, payloadStart + payloadLength * 8);
  const payloadBytes = bitsToBytes(payloadBits);

  const flag = payloadBytes[0];
  const content = payloadBytes.slice(1);

  if (flag === FLAG_ENCRYPTED) {
    if (!password) {
      throw new Error('This image contains an encrypted message. Please provide the password.');
    }
    const plainBytes = await aesDecrypt(content, password);
    return new TextDecoder().decode(plainBytes);
  } else {
    // Plain UTF-8
    return new TextDecoder().decode(content);
  }
}

/**
 * Decode legacy v1 format: STCR + LENGTH(4B) + MESSAGE (charCode-based, optional XOR)
 * Kept for backward compatibility with images encoded before the AES upgrade.
 */
function decodeLegacyV1(allBits, password) {
  const headerStart = MAGIC_LENGTH * 8;

  const lengthBits = allBits.slice(headerStart, headerStart + LENGTH_BITS);
  const messageLength = bitsToNumber(lengthBits);

  if (messageLength <= 0 || messageLength > 10_000_000) {
    throw new Error('Invalid message length detected. The image may not contain a valid hidden message.');
  }

  const messageStart = headerStart + LENGTH_BITS;
  const messageBits = allBits.slice(messageStart, messageStart + messageLength * 8);
  let decoded = bitsToString(messageBits);

  if (password) {
    decoded = xorCipher(decoded, password);
  }

  return decoded;
}

// ─── Raw LSB decode (unchanged) ──────────────────────────────────────────────

/**
 * Decode a hidden message using raw LSB (null-terminated) — compatible with
 * Python PIL / Pillow and other standard tools that don't use a magic header.
 * Reads 1 bit per RGB channel, stops when a null byte (\0) is found.
 *
 * @param {ImageData} imageData - The image data with hidden message
 * @param {number} bitsPerChannel - Bits per channel (1, 2, or 4)
 * @returns {string} The decoded message
 */
export function decodeRaw(imageData, bitsPerChannel = 1) {
  const data = imageData.data;
  const lsbMask = (1 << bitsPerChannel) - 1;

  const allBits = [];
  for (let i = 0; i < data.length; i++) {
    if ((i + 1) % 4 === 0) continue; // Skip alpha
    const value = data[i] & lsbMask;
    for (let b = bitsPerChannel - 1; b >= 0; b--) {
      allBits.push((value >> b) & 1);
    }
  }

  // Assemble bytes and stop at null terminator
  const chars = [];
  for (let i = 0; i + 7 < allBits.length; i += 8) {
    let charCode = 0;
    for (let b = 0; b < 8; b++) {
      charCode = (charCode << 1) | allBits[i + b];
    }
    if (charCode === 0) break; // Null terminator
    chars.push(String.fromCharCode(charCode));
  }

  if (chars.length === 0) {
    throw new Error('No hidden message found (no readable text before null terminator).');
  }

  return chars.join('');
}
