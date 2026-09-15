/**
 * Pure offline-first Code 128 Barcode SVG Generator
 * Generates valid SVG markup without any CDN or external dependencies.
 */

// Code 128 B patterns (widths of alternating bars and spaces, 6 elements each, plus stop pattern of 7 elements)
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112' // 100-106 (106 is STOP)
];

const START_B = 104;
const STOP = 106;

/**
 * Generate an offline Code 128B SVG barcode string.
 * @param {string} text - text to encode
 * @param {object} options - { width = 2, height = 45, displayValue = true, fontSize = 12 }
 * @returns {string} SVG HTML string
 */
export function generateBarcodeSVG(text, options = {}) {
  const {
    width = 2,
    height = 45,
    displayValue = true,
    fontSize = 12,
    color = '#000000',
    background = '#ffffff'
  } = options;

  const cleanText = String(text || '').trim();
  if (!cleanText) return '';

  // Encode with Code 128 B
  const codes = [START_B];
  let checksum = START_B;

  for (let i = 0; i < cleanText.length; i++) {
    const ascii = cleanText.charCodeAt(i);
    const code = ascii - 32;
    if (code < 0 || code > 95) continue;
    codes.push(code);
    checksum += code * (i + 1);
  }

  codes.push(checksum % 103);
  codes.push(STOP);

  // Build pattern sequence
  let patternString = '';
  for (const code of codes) {
    patternString += CODE128_PATTERNS[code] || '';
  }

  // Convert pattern to SVG rectangles
  let currentX = 10; // Left margin
  const quietZone = 10;
  const bars = [];
  let isBar = true;

  for (let i = 0; i < patternString.length; i++) {
    const barWidth = parseInt(patternString[i], 10) * width;
    if (isBar) {
      bars.push(`<rect x="${currentX}" y="5" width="${barWidth}" height="${height}" fill="${color}" />`);
    }
    currentX += barWidth;
    isBar = !isBar;
  }

  const totalWidth = currentX + quietZone;
  const totalHeight = height + (displayValue ? fontSize + 12 : 10);

  const textElement = displayValue
    ? `<text x="${totalWidth / 2}" y="${height + fontSize + 6}" font-family="monospace" font-size="${fontSize}" font-weight="bold" fill="${color}" text-anchor="middle">${cleanText}</text>`
    : '';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}" style="background:${background}; display:inline-block; max-width:100%;">
      ${bars.join('')}
      ${textElement}
    </svg>
  `.trim();
}

export default generateBarcodeSVG;
