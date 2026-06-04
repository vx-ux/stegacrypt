/**
 * Text Steganography using Zero-Width Unicode Characters (v2)
 *
 * Encodes binary data as invisible Unicode characters:
 * - U+200B (Zero-Width Space)      → 0
 * - U+200C (Zero-Width Non-Joiner) → 1
 * - U+FEFF (Zero-Width No-Break Space) → message start/end marker
 *
 * v2 changes:
 * - Optional AES-256-GCM encryption via password
 * - Byte-length header for reliable extraction of encrypted payloads
 * - UTF-8 encoding via TextEncoder (fixes Unicode/emoji support)
 * - Backward-compatible: decodeText() handles both v1 (no header) and v2 (with header) formats
 */

import { aesEncrypt, aesDecrypt } from './crypto.js';

const ZERO = '\u200B'; // 0
const ONE = '\u200C';  // 1
const MARKER = '\uFEFF'; // Start/end marker

const FLAG_PLAIN     = 0x00;
const FLAG_ENCRYPTED = 0x01;

// ─── Bit/Byte helpers ─────────────────────────────────────────────────────────

function bytesToZwChars(bytes) {
  let zwChars = '';
  for (const byte of bytes) {
    for (let i = 7; i >= 0; i--) {
      zwChars += (byte >> i) & 1 ? ONE : ZERO;
    }
  }
  return zwChars;
}

function zwCharsToBytes(hidden) {
  let binaryString = '';
  for (const char of hidden) {
    if (char === ZERO) binaryString += '0';
    else if (char === ONE) binaryString += '1';
  }
  const bytes = new Uint8Array(Math.floor(binaryString.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(binaryString.slice(i * 8, i * 8 + 8), 2);
  }
  return bytes;
}

// ─── Encode ───────────────────────────────────────────────────────────────────

/**
 * Encode a secret message into a cover text using zero-width characters.
 *
 * v2 wire format (between markers):
 *   LENGTH(4 bytes big-endian) + FLAG(1 byte) + PAYLOAD
 *
 * @param {string} coverText - The visible cover text
 * @param {string} secretMessage - The message to hide
 * @param {string} password - Optional password for AES-256-GCM encryption
 * @returns {Promise<string>} The cover text with hidden message embedded
 */
export async function encodeText(coverText, secretMessage, password = '') {
  if (!coverText || !secretMessage) {
    throw new Error('Both cover text and secret message are required.');
  }

  const messageBytes = new TextEncoder().encode(secretMessage);
  let payloadBytes;

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

  // Build: LENGTH(4B big-endian) + payloadBytes
  const header = new Uint8Array(4);
  new DataView(header.buffer).setUint32(0, payloadBytes.byteLength, false);
  const fullPayload = new Uint8Array(header.byteLength + payloadBytes.byteLength);
  fullPayload.set(header, 0);
  fullPayload.set(payloadBytes, 4);

  // Convert to zero-width characters
  const encoded = bytesToZwChars(fullPayload);

  // Wrap with markers
  const hiddenPayload = MARKER + encoded + MARKER;

  // Insert hidden payload after first word
  const firstSpace = coverText.indexOf(' ');
  if (firstSpace === -1) {
    return coverText + hiddenPayload;
  }

  return coverText.slice(0, firstSpace) + hiddenPayload + coverText.slice(firstSpace);
}

// ─── Decode ───────────────────────────────────────────────────────────────────

/**
 * Decode a hidden message from text containing zero-width characters.
 * Supports both v2 (length header + flag + AES) and v1 (raw charCode) formats.
 *
 * @param {string} text - Text that may contain hidden zero-width characters
 * @param {string} password - Password for decryption (if used during encoding)
 * @returns {Promise<string>} The decoded secret message
 */
export async function decodeText(text, password = '') {
  // Find markers
  const firstMarker = text.indexOf(MARKER);
  const lastMarker = text.lastIndexOf(MARKER);

  if (firstMarker === -1 || firstMarker === lastMarker) {
    throw new Error('No hidden message found in this text.');
  }

  // Extract zero-width characters between markers
  const hidden = text.slice(firstMarker + 1, lastMarker);

  // Convert to bytes
  const allBytes = zwCharsToBytes(hidden);

  if (allBytes.length === 0) {
    throw new Error('Invalid hidden message format.');
  }

  // Try v2 format: first 4 bytes are a big-endian length header
  if (allBytes.length >= 5) {
    const declaredLength = new DataView(allBytes.buffer).getUint32(0, false);

    // Sanity check: if the declared length matches remaining bytes, it's v2
    if (declaredLength > 0 && declaredLength === allBytes.length - 4) {
      const payloadBytes = allBytes.slice(4);
      const flag = payloadBytes[0];
      const content = payloadBytes.slice(1);

      if (flag === FLAG_ENCRYPTED) {
        if (!password) {
          throw new Error('This text contains an encrypted message. Please provide the password.');
        }
        const plainBytes = await aesDecrypt(content, password);
        return new TextDecoder().decode(plainBytes);
      } else if (flag === FLAG_PLAIN) {
        return new TextDecoder().decode(content);
      }
    }
  }

  // Fall back to v1: raw binary → charCode (legacy, no header, no encryption)
  let binaryString = '';
  for (const char of hidden) {
    if (char === ZERO) binaryString += '0';
    else if (char === ONE) binaryString += '1';
  }

  if (binaryString.length === 0 || binaryString.length % 8 !== 0) {
    throw new Error('Invalid hidden message format.');
  }

  const chars = [];
  for (let i = 0; i < binaryString.length; i += 8) {
    const byte = binaryString.slice(i, i + 8);
    chars.push(String.fromCharCode(parseInt(byte, 2)));
  }

  return chars.join('');
}

// ─── Analysis (unchanged) ─────────────────────────────────────────────────────

/**
 * Analyze text for zero-width characters
 * @param {string} text - Text to analyze
 * @returns {object} Analysis results
 */
export function analyzeText(text) {
  const zwChars = {
    '\u200B': { name: 'Zero-Width Space', count: 0 },
    '\u200C': { name: 'Zero-Width Non-Joiner', count: 0 },
    '\u200D': { name: 'Zero-Width Joiner', count: 0 },
    '\uFEFF': { name: 'Zero-Width No-Break Space', count: 0 },
  };

  let totalHidden = 0;

  for (const char of text) {
    if (zwChars[char]) {
      zwChars[char].count++;
      totalHidden++;
    }
  }

  return {
    visibleLength: text.replace(/[\u200B\u200C\u200D\uFEFF]/g, '').length,
    actualLength: text.length,
    hiddenCharCount: totalHidden,
    breakdown: zwChars,
    hasHiddenMessage: totalHidden > 0,
  };
}
