const fs = require('fs');
const cp = require('child_process');

// 1. Create OpenSSL config file
const cnf = `
[ req ]
default_bits       = 256
default_md         = sha256
prompt             = no
encrypt_key        = no
distinguished_name = req_distinguished_name
req_extensions     = v3_req

[ req_distinguished_name ]
C  = SA
OU = 1000000001
O  = Al-Basma Trading
CN = Al-Basma POS Test

[ v3_req ]
1.3.6.1.4.1.311.20.2 = ASN1:PRINTABLESTRING:ZATCA-Code-Signing
subjectAltName = dirName:zatca_san

[ zatca_san ]
SN = 1-AlBasma|2-v2|3-SN1782511221.6472
UID = 311111111111113
title = 1100
registeredAddress = Jeddah
businessCategory = Retail
`;
fs.writeFileSync('zatca_openssl.cnf', cnf);

// 2. Generate secp256k1 key
cp.execSync('openssl ecparam -name secp256k1 -genkey -noout -out new_zatca_key.pem');

// 3. Generate CSR
cp.execSync('openssl req -new -sha256 -key new_zatca_key.pem -extensions v3_req -config zatca_openssl.cnf -out new_zatca_csr.pem');

// 4. Read and strip headers for ZATCA portal
const csrPem = fs.readFileSync('new_zatca_csr.pem', 'utf8');
const csrB64 = csrPem.replace(/-----BEGIN CERTIFICATE REQUEST-----/, '').replace(/-----END CERTIFICATE REQUEST-----/, '').replace(/[\\r\\n]/g, '');

console.log('=== NEW CSR BASE64 ===');
console.log(csrB64);
console.log('======================');
