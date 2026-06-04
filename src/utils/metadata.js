

import { extractExif, formatMetadata as formatExifMetadata } from './exif';


const SIGNATURES = {
  JPEG: [0xFF, 0xD8, 0xFF],
  PNG:  [0x89, 0x50, 0x4E, 0x47],
  GIF:  [0x47, 0x49, 0x46],
  BMP:  [0x42, 0x4D],
  TIFF_LE: [0x49, 0x49, 0x2A, 0x00],
  TIFF_BE: [0x4D, 0x4D, 0x00, 0x2A],
  WEBP_RIFF: [0x52, 0x49, 0x46, 0x46],
};

function matchSignature(bytes, sig) {
  return sig.every((b, i) => bytes[i] === b);
}

function detectFormat(buffer) {
  const bytes = new Uint8Array(buffer, 0, Math.min(12, buffer.byteLength));
  if (matchSignature(bytes, SIGNATURES.PNG))  return 'PNG';
  if (matchSignature(bytes, SIGNATURES.JPEG)) return 'JPEG';
  if (matchSignature(bytes, SIGNATURES.GIF))  return 'GIF';
  if (matchSignature(bytes, SIGNATURES.BMP))  return 'BMP';
  if (matchSignature(bytes, SIGNATURES.TIFF_LE) || matchSignature(bytes, SIGNATURES.TIFF_BE)) return 'TIFF';
  if (matchSignature(bytes, SIGNATURES.WEBP_RIFF) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'WebP';
  return 'Unknown';
}


function parsePNG(buffer) {
  const dv = new DataView(buffer);
  const fields = [];
  let offset = 8; // Skip PNG signature

  while (offset + 8 <= dv.byteLength) {
    const length = dv.getUint32(offset, false);
    const typeBytes = new Uint8Array(buffer, offset + 4, 4);
    const type = String.fromCharCode(...typeBytes);

    if (type === 'IHDR' && length >= 13) {
      const width = dv.getUint32(offset + 8, false);
      const height = dv.getUint32(offset + 12, false);
      const bitDepth = dv.getUint8(offset + 16);
      const colorType = dv.getUint8(offset + 17);
      const compression = dv.getUint8(offset + 18);
      const interlace = dv.getUint8(offset + 21);

      const colorTypes = { 0: 'Grayscale', 2: 'RGB', 3: 'Indexed', 4: 'Grayscale+Alpha', 6: 'RGBA' };

      fields.push({ label: 'Dimensions', value: `${width} × ${height}` });
      fields.push({ label: 'Bit Depth', value: String(bitDepth) });
      fields.push({ label: 'Color Type', value: colorTypes[colorType] || String(colorType) });
      fields.push({ label: 'Compression', value: compression === 0 ? 'Deflate' : String(compression) });
      fields.push({ label: 'Interlace', value: interlace === 0 ? 'None' : 'Adam7' });
    }

    if (type === 'tEXt' && length > 0) {
      const chunkData = new Uint8Array(buffer, offset + 8, length);
      const nullIndex = chunkData.indexOf(0);
      if (nullIndex > 0) {
        const key = decodeText(chunkData.subarray(0, nullIndex));
        const val = decodeText(chunkData.subarray(nullIndex + 1));
        fields.push({ label: `tEXt: ${key}`, value: val });
      }
    }

    if (type === 'iTXt' && length > 0) {
      const chunkData = new Uint8Array(buffer, offset + 8, length);
      const nullIndex = chunkData.indexOf(0);
      if (nullIndex > 0) {
        const key = decodeText(chunkData.subarray(0, nullIndex));
        // iTXt has compression flag, method, language, translated keyword, then text
        // Simplified: skip to the text after 3 null bytes
        let textStart = nullIndex + 1;
        let nullCount = 0;
        for (let i = textStart; i < chunkData.length && nullCount < 3; i++) {
          if (chunkData[i] === 0) nullCount++;
          textStart = i + 1;
        }
        const val = decodeText(chunkData.subarray(textStart));
        if (val) fields.push({ label: `iTXt: ${key}`, value: val.substring(0, 500) });
      }
    }

    if (type === 'zTXt' && length > 0) {
      const chunkData = new Uint8Array(buffer, offset + 8, length);
      const nullIndex = chunkData.indexOf(0);
      if (nullIndex > 0) {
        const key = decodeText(chunkData.subarray(0, nullIndex));
        fields.push({ label: `zTXt: ${key}`, value: '(compressed text - raw extraction not supported)' });
      }
    }

    if (type === 'pHYs' && length >= 9) {
      const ppuX = dv.getUint32(offset + 8, false);
      const ppuY = dv.getUint32(offset + 12, false);
      const unit = dv.getUint8(offset + 16);
      if (unit === 1) {
        const dpiX = Math.round(ppuX / 39.3701);
        const dpiY = Math.round(ppuY / 39.3701);
        fields.push({ label: 'DPI', value: `${dpiX} × ${dpiY}` });
      } else {
        fields.push({ label: 'Pixel Aspect', value: `${ppuX} : ${ppuY}` });
      }
    }

    if (type === 'tIME' && length >= 7) {
      const year = dv.getUint16(offset + 8, false);
      const month = dv.getUint8(offset + 10);
      const day = dv.getUint8(offset + 11);
      const hour = dv.getUint8(offset + 12);
      const minute = dv.getUint8(offset + 13);
      const second = dv.getUint8(offset + 14);
      fields.push({
        label: 'Last Modified',
        value: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`,
      });
    }

    if (type === 'gAMA' && length >= 4) {
      const gamma = dv.getUint32(offset + 8, false) / 100000;
      fields.push({ label: 'Gamma', value: gamma.toFixed(5) });
    }

    if (type === 'IEND') break;

    offset += 12 + length; // 4 length + 4 type + data + 4 CRC
  }

  return { fields, gps: null };
}


function parseGIF(buffer) {
  const dv = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const fields = [];

  // Version
  const version = String.fromCharCode(bytes[3], bytes[4], bytes[5]);
  fields.push({ label: 'GIF Version', value: version });

  // Logical screen descriptor
  const width = dv.getUint16(6, true);
  const height = dv.getUint16(8, true);
  fields.push({ label: 'Dimensions', value: `${width} × ${height}` });

  const packed = bytes[10];
  const hasGCT = (packed >> 7) & 1;
  const colorResolution = ((packed >> 4) & 7) + 1;
  const gctSize = hasGCT ? Math.pow(2, (packed & 7) + 1) : 0;

  fields.push({ label: 'Color Resolution', value: `${colorResolution} bits` });
  if (hasGCT) fields.push({ label: 'Global Color Table', value: `${gctSize} colors` });

  const bgColor = bytes[11];
  const aspectRatio = bytes[12];
  if (bgColor > 0) fields.push({ label: 'Background Color Index', value: String(bgColor) });
  if (aspectRatio > 0) fields.push({ label: 'Pixel Aspect Ratio', value: String(aspectRatio) });

  // Scan for comment extensions
  let offset = 13 + (hasGCT ? gctSize * 3 : 0);
  while (offset < bytes.length - 2) {
    if (bytes[offset] === 0x21 && bytes[offset + 1] === 0xFE) {
      // Comment extension
      offset += 2;
      let comment = '';
      while (offset < bytes.length && bytes[offset] !== 0) {
        const blockSize = bytes[offset++];
        for (let i = 0; i < blockSize && offset < bytes.length; i++) {
          comment += String.fromCharCode(bytes[offset++]);
        }
      }
      if (comment) fields.push({ label: 'Comment', value: comment.substring(0, 500) });
      break;
    }
    offset++;
  }

  return { fields, gps: null };
}


function parseBMP(buffer) {
  const dv = new DataView(buffer);
  const fields = [];

  const fileSize = dv.getUint32(2, true);
  const dataOffset = dv.getUint32(10, true);
  const headerSize = dv.getUint32(14, true);

  fields.push({ label: 'File Size', value: formatBytes(fileSize) });

  if (headerSize >= 40) {
    const width = dv.getInt32(18, true);
    const height = Math.abs(dv.getInt32(22, true));
    const planes = dv.getUint16(26, true);
    const bitCount = dv.getUint16(28, true);
    const compression = dv.getUint32(30, true);

    const compressionTypes = { 0: 'None (BI_RGB)', 1: 'RLE8', 2: 'RLE4', 3: 'Bitfields' };

    fields.push({ label: 'Dimensions', value: `${width} × ${height}` });
    fields.push({ label: 'Bit Depth', value: `${bitCount}-bit` });
    fields.push({ label: 'Color Planes', value: String(planes) });
    fields.push({ label: 'Compression', value: compressionTypes[compression] || String(compression) });
    fields.push({ label: 'Data Offset', value: `${dataOffset} bytes` });
    fields.push({ label: 'Header Size', value: `${headerSize} bytes` });

    if (headerSize >= 40) {
      const xPPM = dv.getInt32(38, true);
      const yPPM = dv.getInt32(42, true);
      if (xPPM > 0 && yPPM > 0) {
        fields.push({ label: 'DPI', value: `${Math.round(xPPM / 39.3701)} × ${Math.round(yPPM / 39.3701)}` });
      }
      const colorsUsed = dv.getUint32(46, true);
      if (colorsUsed > 0) fields.push({ label: 'Colors Used', value: String(colorsUsed) });
    }
  }

  return { fields, gps: null };
}


function parseWebP(buffer) {
  const dv = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const fields = [];

  const fileSize = dv.getUint32(4, true) + 8;
  fields.push({ label: 'File Size', value: formatBytes(fileSize) });

  // Check chunk at offset 12
  let offset = 12;
  while (offset + 8 <= dv.byteLength) {
    const chunkId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    const chunkSize = dv.getUint32(offset + 4, true);

    if (chunkId === 'VP8 ' && chunkSize >= 10) {
      // Lossy VP8
      fields.push({ label: 'Encoding', value: 'Lossy (VP8)' });
      // Frame header starts at offset + 8, skip 3 byte frame tag + 7 byte header
      const w = dv.getUint16(offset + 8 + 6, true) & 0x3FFF;
      const h = dv.getUint16(offset + 8 + 8, true) & 0x3FFF;
      if (w > 0 && h > 0) fields.push({ label: 'Dimensions', value: `${w} × ${h}` });
    }

    if (chunkId === 'VP8L' && chunkSize >= 5) {
      // Lossless VP8L
      fields.push({ label: 'Encoding', value: 'Lossless (VP8L)' });
      const b0 = bytes[offset + 9];
      const b1 = bytes[offset + 10];
      const b2 = bytes[offset + 11];
      const b3 = bytes[offset + 12];
      const w = ((b0 | (b1 << 8)) & 0x3FFF) + 1;
      const h = (((b1 >> 6) | (b2 << 2) | (b3 << 10)) & 0x3FFF) + 1;
      fields.push({ label: 'Dimensions', value: `${w} × ${h}` });
    }

    if (chunkId === 'VP8X' && chunkSize >= 10) {
      // Extended format
      const flags = bytes[offset + 8];
      const hasICCP = (flags >> 5) & 1;
      const hasAlpha = (flags >> 4) & 1;
      const hasEXIF = (flags >> 3) & 1;
      const hasXMP = (flags >> 2) & 1;
      const hasAnim = (flags >> 1) & 1;

      const canvasW = (dv.getUint32(offset + 12, true) & 0xFFFFFF) + 1;
      const canvasH = (dv.getUint32(offset + 15, true) & 0xFFFFFF) + 1;
      fields.push({ label: 'Dimensions', value: `${canvasW} × ${canvasH}` });
      fields.push({ label: 'Encoding', value: 'Extended (VP8X)' });

      const features = [];
      if (hasICCP) features.push('ICC Profile');
      if (hasAlpha) features.push('Alpha');
      if (hasEXIF) features.push('EXIF');
      if (hasXMP) features.push('XMP');
      if (hasAnim) features.push('Animation');
      if (features.length) fields.push({ label: 'Features', value: features.join(', ') });
    }

    if (chunkId === 'EXIF' && chunkSize > 0) {
      fields.push({ label: 'EXIF Data', value: 'Present (embedded)' });
    }

    if (chunkId === 'ICCP') {
      fields.push({ label: 'ICC Profile', value: 'Present' });
    }

    if (chunkId === 'XMP ') {
      fields.push({ label: 'XMP Data', value: 'Present' });
    }

    if (chunkId === 'ANIM' && chunkSize >= 6) {
      const bgColor = dv.getUint32(offset + 8, true);
      const loopCount = dv.getUint16(offset + 12, true);
      fields.push({ label: 'Animation BG Color', value: `0x${bgColor.toString(16).padStart(8, '0')}` });
      fields.push({ label: 'Loop Count', value: loopCount === 0 ? 'Infinite' : String(loopCount) });
    }

    offset += 8 + chunkSize;
    if (chunkSize % 2 !== 0) offset++; // Padding
  }

  return { fields, gps: null };
}


function parseTIFF(buffer) {
  // TIFF files share the same IFD structure as EXIF
  const exifData = extractExif(buffer);
  const fields = formatExifMetadata(exifData);
  fields.unshift({ label: 'Format Note', value: 'TIFF uses the same IFD structure as JPEG EXIF' });
  return { fields, gps: exifData.gps };
}


function decodeText(bytes) {
  try {
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return Array.from(bytes).map(b => String.fromCharCode(b)).join('');
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}



export function extractMetadata(buffer, fileName = '') {
  const format = detectFormat(buffer);

  let parsed = { fields: [], gps: null };

  switch (format) {
    case 'JPEG': {
      const exifData = extractExif(buffer);
      const exifFields = formatExifMetadata(exifData);
      parsed = { fields: exifFields, gps: exifData.gps };
      break;
    }
    case 'PNG':
      parsed = parsePNG(buffer);
      break;
    case 'GIF':
      parsed = parseGIF(buffer);
      break;
    case 'BMP':
      parsed = parseBMP(buffer);
      break;
    case 'WebP':
      parsed = parseWebP(buffer);
      break;
    case 'TIFF':
      parsed = parseTIFF(buffer);
      break;
    default:
      break;
  }

  // Prepend basic file info
  const allFields = [
    { label: 'File Name', value: fileName },
    { label: 'File Size', value: formatBytes(buffer.byteLength) },
    { label: 'Format', value: format },
    ...parsed.fields,
  ];

  return { format, fields: allFields, gps: parsed.gps };
}


export function stripMetadata(buffer, format) {
  if (format === 'JPEG') return stripJPEG(buffer);
  if (format === 'PNG') return stripPNG(buffer);
  throw new Error(`Metadata stripping is only supported for JPEG and PNG files. Detected: ${format}`);
}

function stripJPEG(buffer) {
  const bytes = new Uint8Array(buffer);
  const dv = new DataView(buffer);
  const output = [];

  // SOI marker
  output.push(0xFF, 0xD8);

  let offset = 2;
  while (offset < bytes.length - 1) {
    if (bytes[offset] !== 0xFF) { offset++; continue; }

    const marker = bytes[offset + 1];

    // SOS (Start of Scan) - copy everything from here to end (image data)
    if (marker === 0xDA) {
      for (let i = offset; i < bytes.length; i++) {
        output.push(bytes[i]);
      }
      break;
    }

    // Skip APP1 (EXIF/XMP), APP2 (ICC - keep for conservative), APP13 (IPTC)
    if (marker === 0xE1 || marker === 0xED) {
      const segLen = dv.getUint16(offset + 2, false);
      offset += 2 + segLen;
      continue;
    }

    // Keep all other markers
    if (marker >= 0xE0 || marker === 0xDB || marker === 0xC0 || marker === 0xC2 || marker === 0xC4 || marker === 0xDD || marker === 0xFE) {
      const segLen = dv.getUint16(offset + 2, false);
      for (let i = offset; i < offset + 2 + segLen; i++) {
        output.push(bytes[i]);
      }
      offset += 2 + segLen;
    } else {
      output.push(bytes[offset], bytes[offset + 1]);
      offset += 2;
    }
  }

  return new Uint8Array(output).buffer;
}

function stripPNG(buffer) {
  const bytes = new Uint8Array(buffer);
  const dv = new DataView(buffer);
  const output = [];

  // PNG signature
  for (let i = 0; i < 8; i++) output.push(bytes[i]);

  const stripChunks = new Set(['tEXt', 'iTXt', 'zTXt', 'eXIf']);

  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = dv.getUint32(offset, false);
    const typeBytes = new Uint8Array(buffer, offset + 4, 4);
    const type = String.fromCharCode(...typeBytes);

    const totalChunkLen = 12 + length; // 4 length + 4 type + data + 4 CRC

    if (!stripChunks.has(type)) {
      for (let i = offset; i < offset + totalChunkLen && i < bytes.length; i++) {
        output.push(bytes[i]);
      }
    }

    if (type === 'IEND') break;
    offset += totalChunkLen;
  }

  return new Uint8Array(output).buffer;
}

export { detectFormat, formatBytes };
