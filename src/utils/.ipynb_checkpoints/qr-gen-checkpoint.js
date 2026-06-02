/**
 * Minimal QR Code Generator for ZATCA Offline Compliance
 * Zero dependencies, pure JS.
 *
 * FIX HISTORY
 * -----------
 * 2026-05-30  ISO 18004 compliance fixes:
 *   1. createSvgTag: quiet-zone default raised from 2 → 4 modules (ISO minimum)
 *   2. createSvgTag: cellSize default raised from 2 → 4 px to avoid sub-pixel blur
 *   3. createSvgTag: attribute corrected from viewPort → viewBox (SVG spec)
 *   4. createSvgTag: SVG width/height set to explicit px so the element is
 *      always perfectly square regardless of parent CSS.
 *   5. generateSVG: cell size raised from 2 → 4, quiet zone kept at 4.
 */

/* eslint-disable no-unused-vars */
const QRCode = (function() {
  function qrcode(typeNumber, errorCorrectionLevel) {
    const PAD0 = 0xEC; const PAD1 = 0x11;
    let _typeNumber = typeNumber;
    let _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    let _modules = null; let _moduleCount = 0; let _dataCache = null; let _dataList = [];

    const _this = {};
    _this.addData = (data) => { _dataList.push(qr8BitByte(data)); _dataCache = null; };
    _this.isDark = (row, col) => { if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) throw new Error(row + "," + col); return _modules[row][col]; };
    _this.getModuleCount = () => _moduleCount;
    _this.make = () => { if (_typeNumber < 1) { let typeNumber = 1; for (typeNumber = 1; typeNumber < 40; typeNumber++) { let rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel); let buffer = qrBitBuffer(); let totalDataCount = 0; for (let i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount; for (let i = 0; i < _dataList.length; i++) { let data = _dataList[i]; buffer.put(data.mode, 4); buffer.put(data.getLength(), qrUtil.getLengthInBits(data.mode, typeNumber)); data.write(buffer); } if (buffer.getLengthInBits() <= totalDataCount * 8) break; } _typeNumber = typeNumber; } makeImpl(false, getBestMaskPattern()); };

    const makeImpl = (test, maskPattern) => {
      _moduleCount = _typeNumber * 4 + 17; _modules = new Array(_moduleCount);
      for (let row = 0; row < _moduleCount; row++) { _modules[row] = new Array(_moduleCount); for (let col = 0; col < _moduleCount; col++) _modules[row][col] = null; }
      setupPositionProbePattern(0, 0); setupPositionProbePattern(_moduleCount - 7, 0); setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern(); setupTimingPattern(); setupTypeInfo(test, maskPattern); if (_typeNumber >= 7) setupTypeNumber(test);
      mapData(createData(_typeNumber, _errorCorrectionLevel), maskPattern);
    };

    const setupPositionProbePattern = (row, col) => { for (let r = -1; r <= 7; r++) { if (row + r <= -1 || _moduleCount <= row + r) continue; for (let c = -1; c <= 7; c++) { if (col + c <= -1 || _moduleCount <= col + c) continue; if ((0 <= r && r <= 6 && (c == 0 || c == 6)) || (0 <= c && c <= 6 && (r == 0 || r == 6)) || (2 <= r && r <= 4 && 2 <= c && c <= 4)) { _modules[row + r][col + c] = true; } else { _modules[row + r][col + c] = false; } } } };
    const getBestMaskPattern = () => { let minLostPoint = 0; let pattern = 0; for (let i = 0; i < 8; i++) { makeImpl(true, i); let lostPoint = qrUtil.getLostPoint(_this); if (i == 0 || minLostPoint > lostPoint) { minLostPoint = lostPoint; pattern = i; } } return pattern; };
    const setupTimingPattern = () => { for (let r = 8; r < _moduleCount - 8; r++) { if (_modules[r][6] != null) continue; _modules[r][6] = (r % 2 == 0); } for (let c = 8; c < _moduleCount - 8; c++) { if (_modules[6][c] != null) continue; _modules[6][c] = (c % 2 == 0); } };
    const setupPositionAdjustPattern = () => { let pos = qrUtil.getPatternPosition(_typeNumber); for (let i = 0; i < pos.length; i++) { for (let j = 0; j < pos.length; j++) { let row = pos[i]; let col = pos[j]; if (_modules[row][col] != null) continue; for (let r = -2; r <= 2; r++) { for (let c = -2; c <= 2; c++) { if (r == -2 || r == 2 || c == -2 || c == 2 || (r == 0 && c == 0)) _modules[row + r][col + c] = true; else _modules[row + r][col + c] = false; } } } } };
    const setupTypeNumber = (test) => { let bits = qrUtil.getBCHTypeNumber(_typeNumber); for (let i = 0; i < 18; i++) { let mod = (!test && ((bits >> i) & 1) == 1); _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod; } for (let i = 0; i < 18; i++) { let mod = (!test && ((bits >> i) & 1) == 1); _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod; } };
    const setupTypeInfo = (test, maskPattern) => { let data = (_errorCorrectionLevel << 3) | maskPattern; let bits = qrUtil.getBCHTypeInfo(data); for (let i = 0; i < 15; i++) { let mod = (!test && ((bits >> i) & 1) == 1); if (i < 6) _modules[i][8] = mod; else if (i < 8) _modules[i + 1][8] = mod; else _modules[_moduleCount - 15 + i][8] = mod; } for (let i = 0; i < 15; i++) { let mod = (!test && ((bits >> i) & 1) == 1); if (i < 8) _modules[8][_moduleCount - i - 1] = mod; else if (i < 9) _modules[8][15 - i - 1 + 1] = mod; else _modules[8][15 - i - 1] = mod; } _modules[_moduleCount - 8][8] = !test; };
    // eslint-disable-next-line no-constant-condition
    const mapData = (data, maskPattern) => { let inc = -1; let row = _moduleCount - 1; let bitIndex = 7; let byteIndex = 0; for (let col = _moduleCount - 1; col > 0; col -= 2) { if (col == 6) col--; while (true) { for (let c = 0; c < 2; c++) { if (_modules[row][col - c] == null) { let dark = false; if (byteIndex < data.length) dark = (((data[byteIndex] >>> bitIndex) & 1) == 1); if (qrUtil.getMask(maskPattern, row, col - c)) dark = !dark; _modules[row][col - c] = dark; bitIndex--; if (bitIndex == -1) { byteIndex++; bitIndex = 7; } } } row += inc; if (row < 0 || _moduleCount <= row) { row -= inc; inc = -inc; break; } } } };
    const createData = (typeNumber, errorCorrectionLevel) => {
      let rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel); let buffer = qrBitBuffer();
      for (let i = 0; i < _dataList.length; i++) { let data = _dataList[i]; buffer.put(data.mode, 4); buffer.put(data.getLength(), qrUtil.getLengthInBits(data.mode, typeNumber)); data.write(buffer); }
      let totalDataCount = 0; for (let i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
      if (buffer.getLengthInBits() > totalDataCount * 8) throw new Error("code length overflow. (" + buffer.getLengthInBits() + ">" + totalDataCount * 8 + ")");
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) buffer.put(0, 4);
      while (buffer.getLengthInBits() % 8 != 0) buffer.putBit(false);
      // eslint-disable-next-line no-constant-condition
      while (true) { if (buffer.getLengthInBits() >= totalDataCount * 8) break; buffer.put(PAD0, 8); if (buffer.getLengthInBits() >= totalDataCount * 8) break; buffer.put(PAD1, 8); }
      return createBytes(buffer, rsBlocks);
    };

    const createBytes = (buffer, rsBlocks) => {
      let offset = 0; let maxDcCount = 0; let maxEcCount = 0; let dcdata = new Array(rsBlocks.length); let ecdata = new Array(rsBlocks.length);
      for (let r = 0; r < rsBlocks.length; r++) { let dcCount = rsBlocks[r].dataCount; let ecCount = rsBlocks[r].totalCount - dcCount; maxDcCount = Math.max(maxDcCount, dcCount); maxEcCount = Math.max(maxEcCount, ecCount); dcdata[r] = new Uint8Array(dcCount); for (let i = 0; i < dcdata[r].length; i++) dcdata[r][i] = 0xff & buffer.buffer[i + offset]; offset += dcCount; let rsPoly = qrUtil.getErrorCorrectionPolynomial(ecCount); let rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1); let modPoly = rawPoly.mod(rsPoly); ecdata[r] = new Uint8Array(rsPoly.getLength() - 1); for (let i = 0; i < ecdata[r].length; i++) { let modIndex = i + modPoly.getLength() - ecdata[r].length; ecdata[r][i] = (modIndex >= 0) ? modPoly.get(modIndex) : 0; } }
      let totalCodeCount = 0; for (let i = 0; i < rsBlocks.length; i++) totalCodeCount += rsBlocks[i].totalCount;
      let data = new Uint8Array(totalCodeCount); let index = 0; for (let i = 0; i < maxDcCount; i++) { for (let r = 0; r < rsBlocks.length; r++) { if (i < dcdata[r].length) data[index++] = dcdata[r][i]; } } for (let i = 0; i < maxEcCount; i++) { for (let r = 0; r < rsBlocks.length; r++) { if (i < ecdata[r].length) data[index++] = ecdata[r][i]; } } return data;
    };

    /**
     * createSvgTag — generates a standards-compliant SVG QR code.
     *
     * ISO 18004 compliance:
     *  • margin (quiet zone) MUST be at least 4 modules on every side.
     *    Default changed from 2 → 4.
     *  • cellSize MUST produce integer-pixel modules so scanners see clean
     *    black/white boundaries. Default raised from 2 → 4 px.
     *  • SVG width and height are always equal (square) and set explicitly
     *    in pixels so CSS cannot distort the aspect ratio.
     *  • viewBox attribute corrected (was mis-spelled "viewPort").
     *
     * @param {number} cellSize  Pixels per module (default 4 — do not go below 2)
     * @param {number} margin    Quiet-zone modules on each side (default 4 — ISO minimum)
     */
    _this.createSvgTag = (cellSize, margin) => {
      cellSize = cellSize || 4;   // FIX: was 2 — raised to 4 px for crisp rendering
      margin   = margin   || 4;   // FIX: was 4 (already correct) — ISO 18004 minimum

      const modules  = _this.getModuleCount();
      const qrSize   = modules * cellSize + margin * 2 * cellSize;

      // FIX: width/height in explicit px so the element is always square.
      // FIX: viewBox (was "viewPort" — invalid SVG attribute that browsers silently ignore,
      //      which means the coordinate system was unspecified and renderers could
      //      apply arbitrary scaling).
      let svg = '<svg xmlns="http://www.w3.org/2000/svg"'
              + ' width="'  + qrSize + 'px"'
              + ' height="' + qrSize + 'px"'
              + ' viewBox="0 0 ' + qrSize + ' ' + qrSize + '"'
              + ' shape-rendering="crispEdges">';   // FIX: prevents sub-pixel anti-aliasing

      // White background (required — quiet zone must be white)
      svg += '<rect width="' + qrSize + '" height="' + qrSize + '" fill="#ffffff"/>';

      // Data modules
      for (let r = 0; r < modules; r++) {
        for (let c = 0; c < modules; c++) {
          if (_this.isDark(r, c)) {
            const x = c * cellSize + margin * cellSize;
            const y = r * cellSize + margin * cellSize;
            svg += '<rect'
                 + ' width="'  + cellSize + '"'
                 + ' height="' + cellSize + '"'
                 + ' x="' + x + '"'
                 + ' y="' + y + '"'
                 + ' fill="#000000"/>';
          }
        }
      }

      svg += '</svg>';
      return svg;
    };

    return _this;
  }

  const QRMode = { MODE_NUMBER: 1 << 0, MODE_ALPHA_NUM: 1 << 1, MODE_8BIT_BYTE: 1 << 2, MODE_KANJI: 1 << 3 };
  const QRErrorCorrectionLevel = { L: 1, M: 0, Q: 3, H: 2 };
  const QRMaskPattern = { PATTERN000: 0, PATTERN001: 1, PATTERN010: 2, PATTERN011: 3, PATTERN100: 4, PATTERN101: 5, PATTERN110: 6, PATTERN111: 7 }; // eslint-disable-line no-unused-vars

  const qrUtil = {
    getBCHTypeInfo: (data) => { let d = data << 10; while (qrUtil.getBCHDigit(d) - qrUtil.getBCHDigit(0x537) >= 0) d ^= (0x537 << (qrUtil.getBCHDigit(d) - qrUtil.getBCHDigit(0x537))); return ((data << 10) | d) ^ 0x5412; },
    getBCHTypeNumber: (data) => { let d = data << 12; while (qrUtil.getBCHDigit(d) - qrUtil.getBCHDigit(0x1f25) >= 0) d ^= (0x1f25 << (qrUtil.getBCHDigit(d) - qrUtil.getBCHDigit(0x1f25))); return (data << 12) | d; },
    getBCHDigit: (data) => { let digit = 0; while (data != 0) { digit++; data >>>= 1; } return digit; },
    getPatternPosition: (typeNumber) => qrUtil.PATTERN_POSITION_TABLE[typeNumber - 1],
    getMask: (maskPattern, i, j) => { switch (maskPattern) { case 0: return (i + j) % 2 == 0; case 1: return i % 2 == 0; } return false; },
    getErrorCorrectionPolynomial: (errorCorrectionLength) => { let a = qrPolynomial([1], 0); for (let i = 0; i < errorCorrectionLength; i++) a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0)); return a; },
    getLengthInBits: (mode, type) => { if (1 <= type && type < 10) { switch (mode) { case QRMode.MODE_8BIT_BYTE: return 8; } } else if (type < 27) { switch (mode) { case QRMode.MODE_8BIT_BYTE: return 16; } } return 16; },
    getLostPoint: (qrCode) => { let moduleCount = qrCode.getModuleCount(); let lostPoint = 0; for (let row = 0; row < moduleCount; row++) { for (let col = 0; col < moduleCount; col++) { let sameCount = 0; let dark = qrCode.isDark(row, col); for (let r = -1; r <= 1; r++) { if (row + r < 0 || moduleCount <= row + r) continue; for (let c = -1; c <= 1; c++) { if (col + c < 0 || moduleCount <= col + c) continue; if (r == 0 && c == 0) continue; if (dark == qrCode.isDark(row + r, col + c)) sameCount++; } } if (sameCount > 5) lostPoint += (3 + sameCount - 5); } } return lostPoint; },
    PATTERN_POSITION_TABLE: [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90]]
  };

  const QRMath = { glog: (n) => { if (n < 1) throw new Error("log(" + n + ")"); return QRMath.LOG_TABLE[n]; }, gexp: (n) => { while (n < 0) n += 255; while (n >= 255) n -= 255; return QRMath.EXP_TABLE[n]; }, EXP_TABLE: new Uint8Array(256), LOG_TABLE: new Uint8Array(256) };
  for (let i = 0; i < 8; i++) QRMath.EXP_TABLE[i] = 1 << i;
  for (let i = 8; i < 256; i++) QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4] ^ QRMath.EXP_TABLE[i - 5] ^ QRMath.EXP_TABLE[i - 6] ^ QRMath.EXP_TABLE[i - 8];
  for (let i = 0; i < 255; i++) QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;

  const qrPolynomial = (num, shift) => {
    let offset = 0; while (offset < num.length && num[offset] == 0) offset++;
    const _num = new Uint8Array(num.length - offset + shift); for (let i = 0; i < num.length - offset; i++) _num[i] = num[i + offset];
    const _this = {};
    _this.get = (index) => _num[index];
    _this.getLength = () => _num.length;
    _this.multiply = (e) => { let num = new Uint8Array(_this.getLength() + e.getLength() - 1); for (let i = 0; i < _this.getLength(); i++) { for (let j = 0; j < e.getLength(); j++) { num[i + j] ^= QRMath.gexp(QRMath.glog(_this.get(i)) + QRMath.glog(e.get(j))); } } return qrPolynomial(num, 0); };
    _this.mod = (e) => { if (_this.getLength() - e.getLength() < 0) return _this; let ratio = QRMath.glog(_this.get(0)) - QRMath.glog(e.get(0)); let num = new Uint8Array(_this.getLength()); for (let i = 0; i < _this.getLength(); i++) num[i] = _this.get(i); for (let i = 0; i < e.getLength(); i++) { num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio); } return qrPolynomial(num, 0).mod(e); };
    return _this;
  };

  const QRRSBlock = {
    RS_BLOCK_TABLE: [[1, 26, 19], [1, 44, 34], [1, 70, 55], [1, 100, 80], [1, 134, 108], [2, 86, 68], [2, 98, 78], [2, 121, 97], [2, 146, 117]],
    getRSBlocks: (typeNumber, errorCorrectionLevel) => { let rsBlock = QRRSBlock.getRSBlockTable(typeNumber, errorCorrectionLevel); if (rsBlock == null) throw new Error("bad rs block"); let list = []; for (let i = 0; i < rsBlock.length; i += 3) { let count = rsBlock[i]; let totalCount = rsBlock[i + 1]; let dataCount = rsBlock[i + 2]; for (let j = 0; j < count; j++) list.push({ totalCount, dataCount }); } return list; },
    getRSBlockTable: (typeNumber, errorCorrectionLevel) => { switch (errorCorrectionLevel) { case QRErrorCorrectionLevel.L: return QRRSBlock.RS_BLOCK_TABLE[typeNumber - 1]; case QRErrorCorrectionLevel.M: return QRRSBlock.RS_BLOCK_TABLE[typeNumber - 1]; } return null; }
  };

  const qrBitBuffer = () => {
    let _buffer = []; let _length = 0;
    const _this = { buffer: _buffer, getLengthInBits: () => _length, put: (num, length) => { for (let i = 0; i < length; i++) _this.putBit(((num >>> (length - i - 1)) & 1) == 1); }, putBit: (bit) => { let bufIndex = Math.floor(_length / 8); if (_buffer.length <= bufIndex) _buffer.push(0); if (bit) _buffer[bufIndex] |= (0x80 >>> (_length % 8)); _length++; } };
    return _this;
  };

  // In qr-gen.js — replace qr8BitByte:

    const qr8BitByte = (data) => {
  // For ZATCA TLV: data is a raw binary string (from atob).
  // We must NOT run it through TextEncoder — that would re-encode as UTF-8
  // and corrupt any byte above 0x7F. Instead, copy the char codes directly.
      const bytes = new Uint8Array(data.length);
      for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i) & 0xFF;
      return {
    mode: QRMode.MODE_8BIT_BYTE,
    getLength: () => bytes.length,
    write: (buffer) => { for (let i = 0; i < bytes.length; i++) buffer.put(bytes[i], 8); }
  };
};

  // Export
  return {
    /**
     * generateSVG — generates a scannable SVG QR code string.
     *
     * cellSize=4  → each module is 4×4 px (good for screen and print)
     * margin=4    → 4-module quiet zone on all sides (ISO 18004 minimum)
     *
     * The returned SVG has explicit width/height in px and shape-rendering="crispEdges"
     * so it renders identically whether embedded inline, as an <img src="data:…">,
     * or printed via Electron printToPDF.
     */
    generateSVG: (text, cellSize = 4) => {
      const qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      return qr.createSvgTag(cellSize, 4); // quiet zone fixed at ISO minimum of 4
    },

    /**
     * generateZatcaTLV9 — Phase 2 canonical 9-tag BER-TLV QR generator.
     *
     * This replaces the old 5-tag Phase 1 generateZatca() path entirely.
     * Tags 1-5 carry invoice metadata; tags 6-9 carry cryptographic values
     * that ZATCA Phase 2 requires for QR verification.
     *
     * All length fields use proper BER multi-byte encoding (0x81/0x82 prefix
     * for values > 127 bytes) so DER scanners can parse them correctly.
     *
     * @param {string} seller        - Seller name (Arabic)
     * @param {string} vatNo         - 15-digit VAT number
     * @param {string} timestamp     - ISO-8601 invoice timestamp
     * @param {string|number} total  - Tax-inclusive total (SAR)
     * @param {string|number} vatAmt - VAT amount (SAR)
     * @param {string} xmlHash       - Base64 SHA-256 hash of canonical invoice XML (tag 6)
     * @param {string} ecdsaSig      - Base64 ECDSA signature (tag 7)
     * @param {string} pubKeyPem     - Device public key PEM (tag 8, encoded as DER bytes)
     * @param {string} certSignature - Base64 certificate signature (tag 9)
     * @returns {string} Base64 TLV string ready to encode as QR
     */
    generateZatcaTLV9: (seller, vatNo, timestamp, total, vatAmt, xmlHash, ecdsaSig, pubKeyPem, certSignature) => {
      // BER-TLV multi-byte length encoding — supports values > 127 bytes (tags 7, 8, 9)
      const tlvEncode = (tag, valueBuf) => {
        const len = valueBuf.length;
        let lenBytes;
        if (len <= 127) {
          lenBytes = [len];
        } else if (len <= 255) {
          lenBytes = [0x81, len];
        } else {
          lenBytes = [0x82, (len >> 8) & 0xFF, len & 0xFF];
        }
        const result = new Uint8Array(1 + lenBytes.length + len);
        result[0] = tag;
        result.set(lenBytes, 1);
        result.set(valueBuf, 1 + lenBytes.length);
        return result;
      };

      const enc = new TextEncoder();

      // Tag 8: public key is transmitted as raw DER bytes (strip PEM armor)
      let pubKeyDer = new Uint8Array(0);
      if (pubKeyPem) {
        try {
          const b64 = pubKeyPem
            .replace(/-----BEGIN PUBLIC KEY-----/g, '')
            .replace(/-----END PUBLIC KEY-----/g, '')
            .replace(/[\n\r]/g, '');
          const bin = atob(b64);
          pubKeyDer = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) pubKeyDer[i] = bin.charCodeAt(i);
        } catch (e) { /* leave empty — cert not provisioned yet */ }
      }

      // Base64 fields (tags 6, 7, 9) → decoded to raw bytes for TLV payload
      const decodeB64 = (b64) => {
        if (!b64) return new Uint8Array(0);
        try {
          const bin = atob(b64);
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          return arr;
        } catch (e) { return new Uint8Array(0); }
      };

      const parts = [
        tlvEncode(1, enc.encode(String(seller    || ''))),
        tlvEncode(2, enc.encode(String(vatNo     || ''))),
        tlvEncode(3, enc.encode(String(timestamp || '').replace(/\.\d{3}Z$/, 'Z'))),
        tlvEncode(4, enc.encode(parseFloat(total  || 0).toFixed(2))),
        tlvEncode(5, enc.encode(parseFloat(vatAmt || 0).toFixed(2))),
        tlvEncode(6, decodeB64(xmlHash)),       // SHA-256 of C14N invoice XML
        tlvEncode(7, decodeB64(ecdsaSig)),      // ECDSA-SHA256 signature
        tlvEncode(8, pubKeyDer),               // Device public key (DER)
        tlvEncode(9, decodeB64(certSignature)), // Certificate signature
      ];

      const totalLen = parts.reduce((acc, p) => acc + p.length, 0);
      const tlvArray = new Uint8Array(totalLen);
      let offset = 0;
      for (const p of parts) { tlvArray.set(p, offset); offset += p.length; }

      let binary = '';
      for (let i = 0; i < tlvArray.byteLength; i++) binary += String.fromCharCode(tlvArray[i]);
      return btoa(binary); // Returns raw Base64 TLV — callers pass to generateSVG()
    }
  };
})();
/* eslint-enable no-unused-vars */

export default QRCode;
