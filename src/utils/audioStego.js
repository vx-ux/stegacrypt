

import { aesEncrypt, aesDecrypt, bytesToBits, bitsToBytes, AES_OVERHEAD } from './crypto.js';


const MAGIC_V2 = 'STC2';
const MAGIC_V1 = 'STCR';
const MAGIC_LENGTH = 4;
const LENGTH_BITS = 32;
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
    const code = str.charCodeAt(i);
    for (let b = 7; b >= 0; b--) {
      bits.push((code >> b) & 1);
    }
  }
  return bits;
}

function bitsToString(bits) {
  const chars = [];
  for (let i = 0; i + 7 < bits.length; i += 8) {
    let code = 0;
    for (let b = 0; b < 8; b++) {
      code = (code << 1) | (bits[i + b] || 0);
    }
    chars.push(String.fromCharCode(code));
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
  for (const bit of bits) num = (num << 1) | bit;
  return num;
}



function parseWav(buffer) {
  const dv = new DataView(buffer);

  // RIFF header
  const riff = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  const wave = String.fromCharCode(dv.getUint8(8), dv.getUint8(9), dv.getUint8(10), dv.getUint8(11));

  if (riff !== 'RIFF' || wave !== 'WAVE') {
    throw new Error('Not a valid WAV file. Please upload a .wav file.');
  }

  // Walk chunks to find "fmt " and "data"
  let offset = 12;
  let fmtFound = false;
  let audioFormat, numChannels, sampleRate, bitsPerSample;
  let dataOffset = -1;
  let dataSize = -1;

  while (offset + 8 <= dv.byteLength) {
    const chunkId = String.fromCharCode(
      dv.getUint8(offset),
      dv.getUint8(offset + 1),
      dv.getUint8(offset + 2),
      dv.getUint8(offset + 3),
    );
    const chunkSize = dv.getUint32(offset + 4, true); // little-endian

    if (chunkId === 'fmt ') {
      audioFormat  = dv.getUint16(offset + 8,  true);
      numChannels  = dv.getUint16(offset + 10, true);
      sampleRate   = dv.getUint32(offset + 12, true);
      bitsPerSample= dv.getUint16(offset + 22, true);
      fmtFound = true;
    } else if (chunkId === 'data') {
      dataOffset = offset + 8; // first byte of sample data
      dataSize   = chunkSize;
    }

    offset += 8 + chunkSize;
    // Chunks are word-aligned
    if (chunkSize % 2 !== 0) offset++;
  }

  if (!fmtFound) throw new Error('WAV fmt chunk not found.');
  if (dataOffset === -1) throw new Error('WAV data chunk not found.');
  if (audioFormat !== 1) throw new Error('Only uncompressed PCM WAV files are supported (not MP3/AAC compressed WAV).');
  if (bitsPerSample !== 16) throw new Error(`Only 16-bit WAV files are supported. This file uses ${bitsPerSample}-bit samples.`);

  const bytesPerSample = bitsPerSample / 8; // always 2 for 16-bit
  const numSamples = Math.floor(dataSize / bytesPerSample);

  return { dataView: dv, sampleOffset: dataOffset, numSamples, bitsPerSample, numChannels, sampleRate };
}



export function getAudioCapacity(buffer, encrypted = false) {
  const { numSamples } = parseWav(buffer);
  const headerBits = MAGIC_LENGTH * 8 + LENGTH_BITS;
  const availableBits = numSamples - headerBits;
  let availableBytes = Math.max(0, Math.floor(availableBits / 8));

  if (encrypted) {
    availableBytes -= AES_OVERHEAD;
  } else {
    availableBytes -= 1; // flag byte
  }

  return Math.max(0, availableBytes);
}



export async function encodeAudio(buffer, message, password = '') {
  const { dataView, sampleOffset, numSamples } = parseWav(buffer);

  // Build payload bytes: FLAG + content
  const messageBytes = new TextEncoder().encode(message);
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

  // Check capacity
  const capacity = getAudioCapacity(buffer, !!password);
  if (messageBytes.byteLength > capacity) {
    throw new Error(`Message too long. Maximum ~${capacity} characters for this WAV file.`);
  }

  // Build bit stream: MAGIC("STC2") + LENGTH(32-bit, payload byte count) + PAYLOAD
  const allBits = [
    ...stringToBits(MAGIC_V2),
    ...numberToBits(payloadBytes.byteLength, LENGTH_BITS),
    ...bytesToBits(payloadBytes),
  ];

  // Copy the original buffer
  const outBuffer = buffer.slice(0);
  const outView = new DataView(outBuffer);

  // Embed bits into sample LSBs (16-bit little-endian signed samples)
  for (let i = 0; i < allBits.length; i++) {
    const byteOffset = sampleOffset + i * 2; // 2 bytes per 16-bit sample
    if (byteOffset + 2 > outBuffer.byteLength) break;

    const sample = outView.getInt16(byteOffset, true);
    // Clear LSB and set new bit
    const modified = (sample & ~1) | allBits[i];
    outView.setInt16(byteOffset, modified, true);
  }

  return outBuffer;
}



export async function decodeAudio(buffer, password = '') {
  const { dataView, sampleOffset, numSamples } = parseWav(buffer);

  // Extract all LSBs from samples
  const allBits = [];
  for (let i = 0; i < numSamples; i++) {
    const byteOffset = sampleOffset + i * 2;
    if (byteOffset + 2 > dataView.byteLength) break;
    const sample = dataView.getInt16(byteOffset, true);
    allBits.push(sample & 1);
  }

  // Read magic header
  const magicBits = allBits.slice(0, MAGIC_LENGTH * 8);
  const magic = bitsToString(magicBits);

  if (magic === MAGIC_V2) {
    return decodeV2(allBits, password);
  } else if (magic === MAGIC_V1) {
    return decodeLegacyV1(allBits, password);
  } else {
    throw new Error('No hidden message found in this audio file (invalid header).');
  }
}


async function decodeV2(allBits, password) {
  const headerStart = MAGIC_LENGTH * 8;

  const payloadLength = bitsToNumber(allBits.slice(headerStart, headerStart + LENGTH_BITS));

  if (payloadLength <= 0 || payloadLength > 10_000_000) {
    throw new Error('Invalid message length. The file may not contain a hidden message.');
  }

  const payloadStart = headerStart + LENGTH_BITS;
  const payloadBits = allBits.slice(payloadStart, payloadStart + payloadLength * 8);
  const payloadBytes = bitsToBytes(payloadBits);

  const flag = payloadBytes[0];
  const content = payloadBytes.slice(1);

  if (flag === FLAG_ENCRYPTED) {
    if (!password) {
      throw new Error('This audio file contains an encrypted message. Please provide the password.');
    }
    const plainBytes = await aesDecrypt(content, password);
    return new TextDecoder().decode(plainBytes);
  } else {
    return new TextDecoder().decode(content);
  }
}


function decodeLegacyV1(allBits, password) {
  const lengthStart = MAGIC_LENGTH * 8;
  const messageLength = bitsToNumber(allBits.slice(lengthStart, lengthStart + LENGTH_BITS));

  if (messageLength <= 0 || messageLength > 10_000_000) {
    throw new Error('Invalid message length. The file may not contain a hidden message.');
  }

  const msgStart = lengthStart + LENGTH_BITS;
  const messageBits = allBits.slice(msgStart, msgStart + messageLength * 8);
  let decoded = bitsToString(messageBits);

  if (password) decoded = xorCipher(decoded, password);
  return decoded;
}



export function getWaveformData(buffer, numPoints = 300) {
  const { dataView, sampleOffset, numSamples } = parseWav(buffer);

  const samplesPerPoint = Math.max(1, Math.floor(numSamples / numPoints));
  const result = [];
  let maxAmp = 1; // avoid division by zero

  for (let p = 0; p < numPoints; p++) {
    let peak = 0;
    const start = sampleOffset + p * samplesPerPoint * 2;
    for (let s = 0; s < samplesPerPoint; s++) {
      const byteOffset = start + s * 2;
      if (byteOffset + 2 > dataView.byteLength) break;
      const sample = Math.abs(dataView.getInt16(byteOffset, true));
      if (sample > peak) peak = sample;
    }
    result.push(peak);
    if (peak > maxAmp) maxAmp = peak;
  }

  // Normalize to [0, 1]
  return result.map(v => v / maxAmp);
}
