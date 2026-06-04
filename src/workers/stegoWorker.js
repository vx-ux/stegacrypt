import { encode, decode, decodeRaw } from '../utils/lsb';
import { encodeAudio, decodeAudio } from '../utils/audioStego';
import { extractBitPlanes, chiSquareAnalysis, visualAttack } from '../utils/analysis';


self.onmessage = async (e) => {
  const { id, type, payload } = e.data;

  try {
    let result;
    let transfer = [];

    switch (type) {
      case 'lsb:encode':
        // payload: { imageData, message, password, bitsPerChannel }
        result = await encode(payload.imageData, payload.message, payload.bitsPerChannel, payload.password);
        transfer = [result.data.buffer];
        break;

      case 'lsb:decode':
        // payload: { imageData, password, bitsPerChannel }
        result = await decode(payload.imageData, payload.bitsPerChannel, payload.password);
        break;

      case 'lsb:decodeRaw':
        // payload: { imageData, bitsPerChannel }
        result = decodeRaw(payload.imageData, payload.bitsPerChannel);
        break;

      case 'audio:encode':
        // payload: { buffer, message, password }
        result = await encodeAudio(payload.buffer, payload.message, payload.password);
        transfer = [result];
        break;

      case 'audio:decode':
        // payload: { buffer, password }
        result = await decodeAudio(payload.buffer, payload.password);
        break;

      case 'analysis:chiSquare':
        // payload: { imageData }
        result = chiSquareAnalysis(payload.imageData);
        break;

      case 'analysis:bitPlanes':
        // payload: { imageData, channel }
        result = extractBitPlanes(payload.imageData, payload.channel);
        transfer = result.map((plane) => plane.imageData.data.buffer);
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
