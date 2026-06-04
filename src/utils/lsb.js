

import { aesEncrypt, aesDecrypt, bytesToBits, bitsToBytes, AES_OVERHEAD } from './crypto.js';


const MAGIC_V2 = 'STC2';        // v2 magic header (AES-256-GCM)
const MAGIC_V1 = 'STCR';        // v1 magic header (legacy XOR) - decode-only
const MAGIC_LENGTH = 4;          // bytes
const LENGTH_BITS = 32;          // 32-bit payload byte length field
const FLAG_PLAIN     = 0x00;
const FLAG_ENCRYPTED = 0x01;


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
