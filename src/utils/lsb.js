/**
 * LSB Image Steganography
 * Hides data in the Least Significant Bits of image pixel channels.
 */

const MAGIC_HEADER = 'STCR'; // StegaCrypt magic bytes
const HEADER_BITS = 32; // 32 bits for message length

/**
 * XOR encrypt/decrypt a string with a password
 */
function xorCipher(text, password) {
  if (!password) return text;
  const result = [];
  for (let i = 0; i < text.length; i++) {
    result.push(text.charCodeAt(i) ^ password.charCodeAt(i % password.length));
  }
  return String.fromCharCode(...result);
}

/**
 * Convert a string to a binary bit array
 */
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

/**
 * Convert a bit array to a string
 */
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

/**
 * Convert a number to a fixed-length bit array
 */
function numberToBits(num, length) {
  const bits = [];
  for (let i = length - 1; i >= 0; i--) {
    bits.push((num >> i) & 1);
  }
  return bits;
}

/**
 * Convert a bit array to a number
 */
function bitsToNumber(bits) {
  let num = 0;
  for (const bit of bits) {
    num = (num << 1) | bit;
  }
  return num;
}

/**
 * Calculate the maximum number of characters that can be encoded
 * @param {ImageData} imageData - The image data
 * @param {number} bitsPerChannel - Bits per channel (1, 2, or 4)
 * @returns {number} Maximum characters
 */
export function getCapacity(imageData, bitsPerChannel = 1) {
  const totalPixels = imageData.width * imageData.height;
  // Use RGB channels (skip alpha), each stores `bitsPerChannel` bits
  const totalBits = totalPixels * 3 * bitsPerChannel;
  // Subtract header (magic + length) bits
  const headerBits = (MAGIC_HEADER.length * 8) + HEADER_BITS;
  const availableBits = totalBits - headerBits;
  return Math.floor(availableBits / 8);
}

/**
 * Encode a message into image data using LSB steganography
 * @param {ImageData} imageData - The original image data (will be modified in place)
 * @param {string} message - The message to encode
 * @param {number} bitsPerChannel - Bits per channel to use (1, 2, or 4)
 * @param {string} password - Optional password for XOR encryption
 * @returns {ImageData} The modified image data with embedded message
 */
export function encode(imageData, message, bitsPerChannel = 1, password = '') {
  const capacity = getCapacity(imageData, bitsPerChannel);

  if (message.length > capacity) {
    throw new Error(`Message too long. Maximum ${capacity} characters for this image at ${bitsPerChannel} bits/channel.`);
  }

  // Encrypt if password provided
  const payload = password ? xorCipher(message, password) : message;

  // Build the full bit stream: MAGIC + LENGTH(32bit) + MESSAGE
  const magicBits = stringToBits(MAGIC_HEADER);
  const lengthBits = numberToBits(payload.length, HEADER_BITS);
  const messageBits = stringToBits(payload);
  const allBits = [...magicBits, ...lengthBits, ...messageBits];

  const data = imageData.data;
  let bitIndex = 0;

  // Create the LSB mask for clearing the target bits
  const mask = 0xFF << bitsPerChannel; // e.g., 0xFE for 1 bit, 0xFC for 2 bits

  for (let i = 0; i < data.length && bitIndex < allBits.length; i++) {
    // Skip alpha channel (every 4th byte)
    if ((i + 1) % 4 === 0) continue;

    // Read `bitsPerChannel` bits from the stream
    let value = 0;
    for (let b = bitsPerChannel - 1; b >= 0; b--) {
      if (bitIndex < allBits.length) {
        value |= allBits[bitIndex] << b;
        bitIndex++;
      }
    }

    // Clear the LSBs and set the new value
    data[i] = (data[i] & mask) | value;
  }

  return imageData;
}

/**
 * Decode a hidden message from image data
 * @param {ImageData} imageData - The image data with hidden message
 * @param {number} bitsPerChannel - Bits per channel used during encoding
 * @param {string} password - Password for XOR decryption (if used during encoding)
 * @returns {string} The decoded message
 */
export function decode(imageData, bitsPerChannel = 1, password = '') {
  const data = imageData.data;
  const allBits = [];

  // Extract all LSBs
  const lsbMask = (1 << bitsPerChannel) - 1; // e.g., 0x01 for 1 bit, 0x03 for 2 bits

  for (let i = 0; i < data.length; i++) {
    if ((i + 1) % 4 === 0) continue; // Skip alpha

    const value = data[i] & lsbMask;
    for (let b = bitsPerChannel - 1; b >= 0; b--) {
      allBits.push((value >> b) & 1);
    }
  }

  // Read magic header
  const magicBits = allBits.slice(0, MAGIC_HEADER.length * 8);
  const magic = bitsToString(magicBits);

  if (magic !== MAGIC_HEADER) {
    throw new Error('No hidden message found in this image (invalid header).');
  }

  // Read message length
  const lengthBits = allBits.slice(MAGIC_HEADER.length * 8, MAGIC_HEADER.length * 8 + HEADER_BITS);
  const messageLength = bitsToNumber(lengthBits);

  if (messageLength <= 0 || messageLength > 10_000_000) {
    throw new Error('Invalid message length detected. The image may not contain a valid hidden message.');
  }

  // Read message
  const messageStart = MAGIC_HEADER.length * 8 + HEADER_BITS;
  const messageBits = allBits.slice(messageStart, messageStart + messageLength * 8);
  let decoded = bitsToString(messageBits);

  // Decrypt if password provided
  if (password) {
    decoded = xorCipher(decoded, password);
  }

  return decoded;
}

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
