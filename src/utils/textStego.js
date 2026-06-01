/**
 * Text Steganography using Zero-Width Unicode Characters
 * 
 * Encodes binary data as invisible Unicode characters:
 * - U+200B (Zero-Width Space)      → 0
 * - U+200C (Zero-Width Non-Joiner) → 1
 * - U+200D (Zero-Width Joiner)     → separator
 * - U+FEFF (Zero-Width No-Break Space) → message start/end marker
 */

const ZERO = '\u200B'; // 0
const ONE = '\u200C';  // 1
const MARKER = '\uFEFF'; // Start/end marker

/**
 * Encode a secret message into a cover text using zero-width characters
 * @param {string} coverText - The visible cover text
 * @param {string} secretMessage - The message to hide
 * @returns {string} The cover text with hidden message embedded
 */
export function encodeText(coverText, secretMessage) {
  if (!coverText || !secretMessage) {
    throw new Error('Both cover text and secret message are required.');
  }

  // Convert secret message to binary
  const binaryString = Array.from(secretMessage)
    .map(char => {
      const code = char.charCodeAt(0);
      return code.toString(2).padStart(8, '0');
    })
    .join('');

  // Convert binary to zero-width characters
  const encoded = binaryString
    .split('')
    .map(bit => (bit === '0' ? ZERO : ONE))
    .join('');

  // Wrap with markers
  const hiddenPayload = MARKER + encoded + MARKER;

  // Insert hidden payload in the middle of cover text (after first word)
  const firstSpace = coverText.indexOf(' ');
  if (firstSpace === -1) {
    return coverText + hiddenPayload;
  }

  return coverText.slice(0, firstSpace) + hiddenPayload + coverText.slice(firstSpace);
}

/**
 * Decode a hidden message from text containing zero-width characters
 * @param {string} text - Text that may contain hidden zero-width characters
 * @returns {string} The decoded secret message
 */
export function decodeText(text) {
  // Find markers
  const firstMarker = text.indexOf(MARKER);
  const lastMarker = text.lastIndexOf(MARKER);

  if (firstMarker === -1 || firstMarker === lastMarker) {
    throw new Error('No hidden message found in this text.');
  }

  // Extract zero-width characters between markers
  const hidden = text.slice(firstMarker + 1, lastMarker);

  // Convert zero-width chars back to binary
  let binaryString = '';
  for (const char of hidden) {
    if (char === ZERO) binaryString += '0';
    else if (char === ONE) binaryString += '1';
    // Ignore any other characters
  }

  if (binaryString.length === 0 || binaryString.length % 8 !== 0) {
    throw new Error('Invalid hidden message format.');
  }

  // Convert binary to text
  const chars = [];
  for (let i = 0; i < binaryString.length; i += 8) {
    const byte = binaryString.slice(i, i + 8);
    chars.push(String.fromCharCode(parseInt(byte, 2)));
  }

  return chars.join('');
}

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
