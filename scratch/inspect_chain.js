const fs = require('fs');
const path = require('path');
const os = require('os');
let initSqlJs;
try {
  initSqlJs = require('sql.js');
} catch (e) {
  console.error('sql.js not installed. Run npm install sql.js');
  process.exit(1);
}

function findDbPath() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const candidates = ['smart-touch-pos', 'Smart Touch POS', 'SmartTouchPOS', 'my-pos', 'pos'];
  for (const name of candidates) {
    const p = path.join(appData, name, 'pos_data.db');
    if (fs.existsSync(p)) return p;
  }
  const dev = path.join(__dirname, '..', 'pos_data.db');
  if (fs.existsSync(dev)) return dev;
  console.error('pos_data.db not found');
  process.exit(1);
}

(async () => {
  const dbPath = findDbPath();
  console.log('Using DB:', dbPath);
  const SQL = await initSqlJs();
  const fileBuf = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuf);
  const rows = db.exec('SELECT production_cert_pem, production_csid FROM zatca_device LIMIT 1');
  if (!rows.length) { console.error('No zatca_device row'); process.exit(1); }
  const { columns, values } = rows[0];
  const row = Object.fromEntries(columns.map((c,i)=>[c, values[0][i]]));
  const certPem = row.production_cert_pem;
  const csid = row.production_csid;
  if (!certPem) { console.error('No production_cert_pem'); process.exit(1); }
  console.log('Certificate PEM length:', certPem.length);
  const cleanB64 = certPem.replace(/-----BEGIN CERTIFICATE-----/g,'').replace(/-----END CERTIFICATE-----/g,'').replace(/[\r\n\s]/g,'');
  const certDer = Buffer.from(cleanB64, 'base64');
  console.log('DER bytes length:', certDer.length);
  console.log('First 16 bytes (hex):', certDer.slice(0,16).toString('hex'));

  function derReadTLV(buf, offset){
    const tag = buf[offset];
    const lenByte = buf[offset+1];
    let length, valueStart;
    if (lenByte & 0x80) {
      const numLenBytes = lenByte & 0x7f;
      length = 0;
      for(let i=0;i<numLenBytes;i++) length = (length<<8) | buf[offset+2+i];
      valueStart = offset+2+numLenBytes;
    } else { length = lenByte; valueStart = offset+2; }
    return {tag, length, valueStart, valueEnd: valueStart+length, nextOffset: valueStart+length};
  }

  const tlv = derReadTLV(certDer,0);
  console.log('Cert TLV tag (hex):', tlv.tag.toString(16), 'length:', tlv.length, 'nextOffset:', tlv.nextOffset);
  console.log('Cert TLV bytes (hex):', certDer.slice(0, tlv.nextOffset).toString('hex'));

  const csidObj = JSON.parse(csid);
  const token = csidObj.binarySecurityToken;
  if (!token) { console.error('No binarySecurityToken in csid'); process.exit(1); }
  const tokenClean = token.replace(/[\s\n\r]/g,'');
  const tokenDer = Buffer.from(tokenClean, 'base64');
  console.log('binarySecurityToken DER length:', tokenDer.length);
  console.log('First 16 bytes (hex):', tokenDer.slice(0,16).toString('hex'));
  const tokenTLV = derReadTLV(tokenDer,0);
  console.log('Token TLV tag (hex):', tokenTLV.tag.toString(16), 'length:', tokenTLV.length, 'nextOffset:', tokenTLV.nextOffset);
  console.log('Token TLV bytes (hex):', tokenDer.slice(0, tokenTLV.nextOffset).toString('hex'));
})();
