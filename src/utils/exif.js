


function readUint16(dataView, offset, littleEndian) {
  return dataView.getUint16(offset, littleEndian);
}


function readUint32(dataView, offset, littleEndian) {
  return dataView.getUint32(offset, littleEndian);
}


function readString(dataView, offset, length) {
  let str = '';
  for (let i = 0; i < length; i++) {
    const code = dataView.getUint8(offset + i);
    if (code === 0) break;
    str += String.fromCharCode(code);
  }
  return str.trim();
}


function readRational(dataView, offset, littleEndian) {
  const numerator = readUint32(dataView, offset, littleEndian);
  const denominator = readUint32(dataView, offset + 4, littleEndian);
  return denominator ? numerator / denominator : 0;
}

// EXIF tag names
const EXIF_TAGS = {
  0x010F: 'Make',
  0x0110: 'Model',
  0x0112: 'Orientation',
  0x011A: 'XResolution',
  0x011B: 'YResolution',
  0x0128: 'ResolutionUnit',
  0x0131: 'Software',
  0x0132: 'DateTime',
  0x013B: 'Artist',
  0x8769: 'ExifIFDPointer',
  0x8825: 'GPSInfoIFDPointer',
  0xA000: 'FlashpixVersion',
  0xA001: 'ColorSpace',
  0xA002: 'PixelXDimension',
  0xA003: 'PixelYDimension',
  0x829A: 'ExposureTime',
  0x829D: 'FNumber',
  0x8827: 'ISOSpeedRatings',
  0x9000: 'ExifVersion',
  0x9003: 'DateTimeOriginal',
  0x9004: 'DateTimeDigitized',
  0x920A: 'FocalLength',
  0xA405: 'FocalLengthIn35mmFilm',
  0xA420: 'ImageUniqueID',
  0x9209: 'Flash',
  0xA433: 'LensMake',
  0xA434: 'LensModel',
};

const GPS_TAGS = {
  0x0001: 'GPSLatitudeRef',
  0x0002: 'GPSLatitude',
  0x0003: 'GPSLongitudeRef',
  0x0004: 'GPSLongitude',
  0x0005: 'GPSAltitudeRef',
  0x0006: 'GPSAltitude',
};


function parseIFD(dataView, tiffStart, ifdOffset, littleEndian, tagMap) {
  const entries = {};
  const numEntries = readUint16(dataView, tiffStart + ifdOffset, littleEndian);

  for (let i = 0; i < numEntries; i++) {
    const entryOffset = tiffStart + ifdOffset + 2 + i * 12;

    if (entryOffset + 12 > dataView.byteLength) break;

    const tag = readUint16(dataView, entryOffset, littleEndian);
    const type = readUint16(dataView, entryOffset + 2, littleEndian);
    const count = readUint32(dataView, entryOffset + 4, littleEndian);
    const valueOffset = entryOffset + 8;

    const tagName = tagMap[tag];
    if (!tagName) continue;

    let value;
    try {
      switch (type) {
        case 1: // BYTE
          value = dataView.getUint8(valueOffset);
          break;
        case 2: // ASCII
          if (count <= 4) {
            value = readString(dataView, valueOffset, count);
          } else {
            const strOffset = readUint32(dataView, valueOffset, littleEndian);
            value = readString(dataView, tiffStart + strOffset, count);
          }
          break;
        case 3: // SHORT
          value = readUint16(dataView, valueOffset, littleEndian);
          break;
        case 4: // LONG
          value = readUint32(dataView, valueOffset, littleEndian);
          break;
        case 5: // RATIONAL
          if (count === 1) {
            const ratOffset = readUint32(dataView, valueOffset, littleEndian);
            value = readRational(dataView, tiffStart + ratOffset, littleEndian);
          } else if (count === 3) {
            // GPS coordinates
            const coordOffset = readUint32(dataView, valueOffset, littleEndian);
            const degrees = readRational(dataView, tiffStart + coordOffset, littleEndian);
            const minutes = readRational(dataView, tiffStart + coordOffset + 8, littleEndian);
            const seconds = readRational(dataView, tiffStart + coordOffset + 16, littleEndian);
            value = [degrees, minutes, seconds];
          }
          break;
        case 7: // UNDEFINED
          if (count <= 4) {
            value = readString(dataView, valueOffset, count);
          } else {
            const undOffset = readUint32(dataView, valueOffset, littleEndian);
            value = readString(dataView, tiffStart + undOffset, Math.min(count, 32));
          }
          break;
        default:
          value = readUint32(dataView, valueOffset, littleEndian);
      }
    } catch {
      value = 'Unable to read';
    }

    entries[tagName] = value;
  }

  return entries;
}


function dmsToDecimal(dms, ref) {
  if (!Array.isArray(dms) || dms.length !== 3) return null;
  let decimal = dms[0] + dms[1] / 60 + dms[2] / 3600;
  if (ref === 'S' || ref === 'W') decimal = -decimal;
  return decimal;
}


export function extractExif(buffer) {
  const dataView = new DataView(buffer);
  const metadata = {
    basic: {},
    camera: {},
    gps: null,
    raw: {},
  };

  // Check for JPEG SOI marker
  if (dataView.getUint8(0) !== 0xFF || dataView.getUint8(1) !== 0xD8) {
    // Not a JPEG, return basic info only
    return metadata;
  }

  // Find APP1 marker (EXIF)
  let offset = 2;
  while (offset < dataView.byteLength - 4) {
    const marker = dataView.getUint8(offset);
    if (marker !== 0xFF) {
      offset++;
      continue;
    }

    const markerType = dataView.getUint8(offset + 1);

    if (markerType === 0xE1) {
      // APP1 - EXIF data
      const segmentLength = readUint16(dataView, offset + 2, false);

      // Check for "Exif\0\0" header
      const exifHeader = readString(dataView, offset + 4, 4);
      if (exifHeader !== 'Exif') {
        offset += 2 + segmentLength;
        continue;
      }

      const tiffStart = offset + 10; // After "Exif\0\0"

      // Determine byte order
      const byteOrder = readUint16(dataView, tiffStart, false);
      const littleEndian = byteOrder === 0x4949; // 'II' = Intel = Little Endian

      // Get IFD0 offset
      const ifd0Offset = readUint32(dataView, tiffStart + 4, littleEndian);

      // Parse IFD0
      const ifd0 = parseIFD(dataView, tiffStart, ifd0Offset, littleEndian, EXIF_TAGS);
      Object.assign(metadata.raw, ifd0);

      // Parse EXIF sub-IFD
      if (ifd0.ExifIFDPointer) {
        const exifIFD = parseIFD(dataView, tiffStart, ifd0.ExifIFDPointer, littleEndian, EXIF_TAGS);
        Object.assign(metadata.raw, exifIFD);
      }

      // Parse GPS IFD
      if (ifd0.GPSInfoIFDPointer) {
        const gpsIFD = parseIFD(dataView, tiffStart, ifd0.GPSInfoIFDPointer, littleEndian, GPS_TAGS);

        const lat = dmsToDecimal(gpsIFD.GPSLatitude, gpsIFD.GPSLatitudeRef);
        const lng = dmsToDecimal(gpsIFD.GPSLongitude, gpsIFD.GPSLongitudeRef);

        if (lat !== null && lng !== null) {
          metadata.gps = {
            latitude: lat,
            longitude: lng,
            latRef: gpsIFD.GPSLatitudeRef,
            lngRef: gpsIFD.GPSLongitudeRef,
            altitude: gpsIFD.GPSAltitude || null,
          };
        }
      }

      // Organize into categories
      metadata.camera = {
        make: ifd0.Make || metadata.raw.Make,
        model: ifd0.Model || metadata.raw.Model,
        software: ifd0.Software,
        exposureTime: metadata.raw.ExposureTime,
        fNumber: metadata.raw.FNumber,
        iso: metadata.raw.ISOSpeedRatings,
        focalLength: metadata.raw.FocalLength,
        flash: metadata.raw.Flash,
        lensMake: metadata.raw.LensMake,
        lensModel: metadata.raw.LensModel,
      };

      metadata.basic = {
        dateTime: ifd0.DateTime || metadata.raw.DateTimeOriginal,
        orientation: ifd0.Orientation,
        width: metadata.raw.PixelXDimension,
        height: metadata.raw.PixelYDimension,
        colorSpace: metadata.raw.ColorSpace,
        artist: ifd0.Artist,
      };

      break;
    } else if (markerType === 0xDA) {
      // Start of Scan - no more metadata after this
      break;
    } else {
      const segLen = readUint16(dataView, offset + 2, false);
      offset += 2 + segLen;
    }
  }

  return metadata;
}


export function formatMetadata(metadata) {
  const items = [];

  // Basic info
  if (metadata.basic.dateTime) items.push({ label: 'Date Taken', value: metadata.basic.dateTime });
  if (metadata.basic.width && metadata.basic.height) {
    items.push({ label: 'Dimensions', value: `${metadata.basic.width} × ${metadata.basic.height}` });
  }
  if (metadata.basic.orientation) items.push({ label: 'Orientation', value: String(metadata.basic.orientation) });
  if (metadata.basic.colorSpace) items.push({ label: 'Color Space', value: metadata.basic.colorSpace === 1 ? 'sRGB' : 'Uncalibrated' });
  if (metadata.basic.artist) items.push({ label: 'Artist', value: metadata.basic.artist });

  // Camera
  if (metadata.camera.make) items.push({ label: 'Camera Make', value: metadata.camera.make });
  if (metadata.camera.model) items.push({ label: 'Camera Model', value: metadata.camera.model });
  if (metadata.camera.software) items.push({ label: 'Software', value: metadata.camera.software });
  if (metadata.camera.exposureTime) items.push({ label: 'Exposure', value: `1/${Math.round(1 / metadata.camera.exposureTime)}s` });
  if (metadata.camera.fNumber) items.push({ label: 'Aperture', value: `f/${metadata.camera.fNumber}` });
  if (metadata.camera.iso) items.push({ label: 'ISO', value: String(metadata.camera.iso) });
  if (metadata.camera.focalLength) items.push({ label: 'Focal Length', value: `${metadata.camera.focalLength}mm` });
  if (metadata.camera.lensMake) items.push({ label: 'Lens Make', value: metadata.camera.lensMake });
  if (metadata.camera.lensModel) items.push({ label: 'Lens Model', value: metadata.camera.lensModel });

  // GPS
  if (metadata.gps) {
    items.push({ label: 'GPS Latitude', value: `${metadata.gps.latitude.toFixed(6)}° ${metadata.gps.latRef}` });
    items.push({ label: 'GPS Longitude', value: `${metadata.gps.longitude.toFixed(6)}° ${metadata.gps.lngRef}` });
    if (metadata.gps.altitude) items.push({ label: 'GPS Altitude', value: `${metadata.gps.altitude.toFixed(1)}m` });
  }

  return items;
}
