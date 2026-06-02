/**
 * Audio LSB Steganography — WAV file support
 *
 * Hides text messages in the Least Significant Bits of 16-bit PCM WAV audio samples.
 * The change to each sample is ±1 amplitude unit — completely inaudible.
 *
 * Format support: PCM WAV (16-bit, mono or stereo)
 * Uses the same magic header (STCR) and XOR cipher as lsb.js for consistency.
 */

const MAGIC = 'STCR';
const HEADER_BITS = 32; // 32-bit message length field

// ─── XOR cipher (same as lsb.js) ────────────────────────────────────────────

function xorCipher(text, password) {
  if (!password) return text;
  const result = [];
  for (let i = 0; i < text.length; i++) {
    result.push(text.charCodeAt(i) ^ password.charCodeAt(i % password.length));
  }
  return String.fromCharCode(...result);
}

// ─── Bit helpers ─────────────────────────────────────────────────────────────

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

// ─── WAV Parser ───────────────────────────────────────────────────────────────

/**
 * Parse a WAV ArrayBuffer and return metadata + data chunk location.
 * Throws a descriptive error if the file is not a supported PCM WAV.
 *
 * @param {ArrayBuffer} buffer
 * @returns {{ dataView: DataView, sampleOffset: number, numSamples: number,
 *             bitsPerSample: number, numChannels: number, sampleRate: number }}
 */
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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Calculate maximum characters that can be hidden in this WAV file.
 * @param {ArrayBuffer} buffer
 * @returns {number} max characters
 */
export function getAudioCapacity(buffer) {
  const { numSamples } = parseWav(buffer);
  const headerBits = MAGIC.length * 8 + HEADER_BITS;
  const availableBits = numSamples - headerBits;
  return Math.max(0, Math.floor(availableBits / 8));
}

/**
 * Encode a message into the LSBs of WAV audio samples.
 * Returns a new ArrayBuffer representing the modified WAV file.
 *
 * @param {ArrayBuffer} buffer   - Original WAV file
 * @param {string}      message  - Text to hide
 * @param {string}      password - Optional XOR encryption key
 * @returns {ArrayBuffer} New WAV buffer with embedded message
 */
export function encodeAudio(buffer, message, password = '') {
  const { dataView, sampleOffset, numSamples } = parseWav(buffer);

  const capacity = Math.floor((numSamples - MAGIC.length * 8 - HEADER_BITS) / 8);
  if (message.length > capacity) {
    throw new Error(`Message too long. Maximum ${capacity} characters for this WAV file.`);
  }

  // Payload (optionally encrypted)
  const payload = password ? xorCipher(message, password) : message;

  // Build bit stream: MAGIC + LENGTH(32) + MESSAGE
  const allBits = [
    ...stringToBits(MAGIC),
    ...numberToBits(payload.length, HEADER_BITS),
    ...stringToBits(payload),
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

/**
 * Decode a hidden message from WAV audio sample LSBs.
 *
 * @param {ArrayBuffer} buffer   - WAV file potentially containing a hidden message
 * @param {string}      password - Password used during encoding (if any)
 * @returns {string} Decoded message
 */
export function decodeAudio(buffer, password = '') {
  const { dataView, sampleOffset, numSamples } = parseWav(buffer);

  // Extract all LSBs from samples
  const allBits = [];
  for (let i = 0; i < numSamples; i++) {
    const byteOffset = sampleOffset + i * 2;
    if (byteOffset + 2 > dataView.byteLength) break;
    const sample = dataView.getInt16(byteOffset, true);
    allBits.push(sample & 1);
  }

  // Verify magic header
  const magicBits = allBits.slice(0, MAGIC.length * 8);
  const magic = bitsToString(magicBits);
  if (magic !== MAGIC) {
    throw new Error('No hidden message found in this audio file (invalid header).');
  }

  // Read message length
  const lengthStart = MAGIC.length * 8;
  const messageLength = bitsToNumber(allBits.slice(lengthStart, lengthStart + HEADER_BITS));

  if (messageLength <= 0 || messageLength > 10_000_000) {
    throw new Error('Invalid message length. The file may not contain a hidden message.');
  }

  // Read message bits
  const msgStart = lengthStart + HEADER_BITS;
  const messageBits = allBits.slice(msgStart, msgStart + messageLength * 8);
  let decoded = bitsToString(messageBits);

  if (password) decoded = xorCipher(decoded, password);
  return decoded;
}

/**
 * Generate a downsampled waveform amplitude array for visualization.
 * Returns an array of values in the range [0, 1] representing amplitude.
 *
 * @param {ArrayBuffer} buffer    - WAV file
 * @param {number}      numPoints - Number of points to return (e.g. 300 for a bar chart)
 * @returns {number[]} Normalized amplitude array
 */
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
