const { app } = require('electron');
const fs = require('fs');
const { execSync } = require('child_process');

app.whenReady().then(() => {
  const dbPath = 'C:\\Users\\bin-g\\AppData\\Roaming\\البصمة الذكية\\pos_data.db';
  const db = require('better-sqlite3')(dbPath);
  
  // Get latest unsigned XML
  const queue = db.prepare('SELECT signed_xml FROM zatca_queue ORDER BY id DESC LIMIT 1').get();
  if (!queue || !queue.signed_xml) process.exit(0);
  
  // Extract certificate for Fatoora config
  const certMatch = queue.signed_xml.match(/<ds:X509Certificate>([^<]+)<\/ds:X509Certificate>/);
  if (certMatch) {
      fs.writeFileSync('cert.pem', `-----BEGIN CERTIFICATE-----\n${certMatch[1].match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`);
  }
  
  const rawXml = queue.signed_xml.replace(/<ext:UBLExtensions>[\s\S]*?<\/ext:UBLExtensions>/, '');
  fs.writeFileSync('unsigned.xml', rawXml);
  
  // Sign using SDK
  try {
      execSync('fatoora -sign -invoice unsigned.xml -signedInvoice fatoora_signed.xml', { stdio: 'pipe' });
      const signed = fs.readFileSync('fatoora_signed.xml', 'utf8');
      
      const fatooraIssuer = signed.match(/<ds:X509IssuerName>([^<]+)<\/ds:X509IssuerName>/);
      const myIssuer = queue.signed_xml.match(/<ds:X509IssuerName>([^<]+)<\/ds:X509IssuerName>/);
      
      const fatooraHash = signed.match(/<ds:DigestValue>([^<]+)<\/ds:DigestValue>/g);
      const myHash = queue.signed_xml.match(/<ds:DigestValue>([^<]+)<\/ds:DigestValue>/g);
      
      console.log('--- ISSUER NAME ---');
      console.log('FATOORA:', fatooraIssuer ? fatooraIssuer[1] : 'Not found');
      console.log('MY CODE:', myIssuer ? myIssuer[1] : 'Not found');
      console.log('MATCH:', fatooraIssuer && myIssuer && fatooraIssuer[1] === myIssuer[1]);
      
      console.log('\n--- HASHES ---');
      console.log('FATOORA:', fatooraHash);
      console.log('MY CODE:', myHash);
      
  } catch (e) {
      console.log("Fatoora error:", e.message);
  }
  process.exit(0);
});
