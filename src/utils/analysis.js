/**
 * Steganalysis — Tools for detecting hidden data in images
 */

/**
 * Extract bit planes from image data
 * Returns an array of ImageData objects, one per bit plane
 * @param {ImageData} imageData - Source image
 * @param {string} channel - 'r', 'g', 'b', or 'all'
 * @returns {Array<{name: string, imageData: ImageData}>}
 */
export function extractBitPlanes(imageData, channel = 'all') {
  const { width, height, data } = imageData;
  const planes = [];

  const channelOffsets = {
    r: [0],
    g: [1],
    b: [2],
    all: [0, 1, 2],
  };

  const channelNames = { 0: 'Red', 1: 'Green', 2: 'Blue' };
  const offsets = channelOffsets[channel] || [0, 1, 2];

  for (const chOffset of offsets) {
    for (let bit = 0; bit < 8; bit++) {
      const planeData = new ImageData(width, height);

      for (let i = 0; i < data.length; i += 4) {
        const pixelValue = data[i + chOffset];
        const bitValue = (pixelValue >> bit) & 1;
        const color = bitValue * 255;

        planeData.data[i] = color;
        planeData.data[i + 1] = color;
        planeData.data[i + 2] = color;
        planeData.data[i + 3] = 255;
      }

      planes.push({
        name: `${channelNames[chOffset]} - Bit ${bit}${bit === 0 ? ' (LSB)' : bit === 7 ? ' (MSB)' : ''}`,
        imageData: planeData,
        channel: channelNames[chOffset],
        bit,
      });
    }
  }

  return planes;
}

/**
 * Chi-Square Analysis for LSB steganography detection
 * Based on the chi-square test for uniformity of LSB pairs
 * @param {ImageData} imageData - Image to analyze
 * @returns {object} Analysis results with confidence score
 */
export function chiSquareAnalysis(imageData) {
  const { data } = imageData;
  const results = [];

  // Analyze each color channel
  const channelNames = ['Red', 'Green', 'Blue'];

  for (let ch = 0; ch < 3; ch++) {
    // Count pixel value pairs (2i, 2i+1) — PoVs (Pairs of Values)
    const histogram = new Array(256).fill(0);

    for (let i = 0; i < data.length; i += 4) {
      histogram[data[i + ch]]++;
    }

    // Chi-square statistic for LSB pairs
    let chiSquare = 0;
    let degreesOfFreedom = 0;

    for (let i = 0; i < 128; i++) {
      const observed2i = histogram[2 * i];
      const observed2i1 = histogram[2 * i + 1];
      const expected = (observed2i + observed2i1) / 2;

      if (expected > 0) {
        chiSquare += Math.pow(observed2i - expected, 2) / expected;
        chiSquare += Math.pow(observed2i1 - expected, 2) / expected;
        degreesOfFreedom++;
      }
    }

    // Calculate p-value approximation using incomplete gamma function
    const pValue = 1 - chiSquareCDF(chiSquare, degreesOfFreedom);

    results.push({
      channel: channelNames[ch],
      chiSquare: chiSquare.toFixed(2),
      degreesOfFreedom,
      pValue: pValue.toFixed(6),
      suspicious: pValue > 0.95,
    });
  }

  // Overall assessment
  const avgPValue = results.reduce((sum, r) => sum + parseFloat(r.pValue), 0) / results.length;
  const overallSuspicious = results.some(r => r.suspicious);

  return {
    channels: results,
    overallPValue: avgPValue.toFixed(6),
    isSuspicious: overallSuspicious,
    confidence: overallSuspicious
      ? `High probability of LSB steganography (p=${avgPValue.toFixed(4)})`
      : `No strong evidence of LSB steganography detected (p=${avgPValue.toFixed(4)})`,
  };
}

/**
 * Approximate chi-square CDF using the regularized incomplete gamma function
 */
function chiSquareCDF(x, k) {
  if (x <= 0) return 0;
  return regularizedGammaP(k / 2, x / 2);
}

/**
 * Regularized incomplete gamma function P(a, x)
 * Using series expansion for small x
 */
function regularizedGammaP(a, x) {
  if (x < 0) return 0;
  if (x === 0) return 0;

  // Use series expansion
  const maxIterations = 200;
  let sum = 0;
  let term = 1 / a;
  sum = term;

  for (let n = 1; n < maxIterations; n++) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < 1e-10 * Math.abs(sum)) break;
  }

  return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

/**
 * Log-gamma function (Lanczos approximation)
 */
function logGamma(x) {
  const coefficients = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.1208650973866179e-2,
    -0.5395239384953e-5,
  ];

  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;

  for (let j = 0; j < coefficients.length; j++) {
    ser += coefficients[j] / ++y;
  }

  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

/**
 * Generate histogram data for an image
 * @param {ImageData} imageData
 * @returns {object} Histogram data for each channel
 */
export function generateHistogram(imageData) {
  const { data } = imageData;
  const channels = {
    red: new Array(256).fill(0),
    green: new Array(256).fill(0),
    blue: new Array(256).fill(0),
    luminance: new Array(256).fill(0),
  };

  for (let i = 0; i < data.length; i += 4) {
    channels.red[data[i]]++;
    channels.green[data[i + 1]]++;
    channels.blue[data[i + 2]]++;

    // Luminance
    const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    channels.luminance[lum]++;
  }

  return channels;
}

/**
 * Visual attack — enhance LSB differences
 * @param {ImageData} imageData
 * @returns {ImageData} Enhanced image showing LSB patterns
 */
export function visualAttack(imageData) {
  const { width, height, data } = imageData;
  const result = new ImageData(width, height);

  for (let i = 0; i < data.length; i += 4) {
    // Amplify LSBs by mapping them to full range
    result.data[i] = (data[i] & 1) * 255;
    result.data[i + 1] = (data[i + 1] & 1) * 255;
    result.data[i + 2] = (data[i + 2] & 1) * 255;
    result.data[i + 3] = 255;
  }

  return result;
}
