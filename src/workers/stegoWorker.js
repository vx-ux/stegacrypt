import { encode, decode } from '../utils/lsb';
import { encodeAudio, decodeAudio } from '../utils/audioStego';
import { extractBitPlanes, chiSquareAnalysis, visualAttack } from '../utils/analysis';

/**
 * Web Worker for heavy steganography and analysis tasks.
 * Moves processing off the main UI thread to prevent freezing during large image/audio encoding.
 */
self.onmessage = async (e) => {
  const { id, type, payload } = e.data;

  try {
    let result;
    let transfer = [];

    switch (type) {
      // ─── Image Steganography ───
      case 'lsb:encode':
        // payload: { imageData, message, password, bitsPerChannel }
        result = encode(payload.imageData, payload.message, payload.bitsPerChannel, payload.password);
        transfer = [result.data.buffer];
        break;

      case 'lsb:decode':
        // payload: { imageData, password, bitsPerChannel }
        result = decode(payload.imageData, payload.bitsPerChannel, payload.password);
        break;

      // ─── Audio Steganography ───
      case 'audio:encode':
        // payload: { buffer, message, password }
        result = encodeAudio(payload.buffer, payload.message, payload.password);
        transfer = [result];
        break;

      case 'audio:decode':
        // payload: { buffer, password }
        result = decodeAudio(payload.buffer, payload.password);
        break;

      // ─── Steganalysis ───
      case 'analysis:chiSquare':
        // payload: { imageData }
        result = chiSquareAnalysis(payload.imageData);
        break;

      case 'analysis:bitPlanes':
        // payload: { imageData, channel }
        result = extractBitPlanes(payload.imageData, payload.channel);
        transfer = result.map((imgData) => imgData.data.buffer);
        break;

      case 'analysis:visualAttack':
        // payload: { imageData }
        result = visualAttack(payload.imageData);
        transfer = [result.data.buffer];
        break;

      default:
        throw new Error(`Unknown worker task type: ${type}`);
    }

    self.postMessage({ id, status: 'success', result }, transfer);
  } catch (error) {
    self.postMessage({ id, status: 'error', error: error.message });
  }
};
