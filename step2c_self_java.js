/**
 * Final verification: Does Java's own C14N on java_signed3.xml produce
 * the DigestValue recorded IN java_signed3.xml?
 */
const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');

// Recorded in java_signed3.xml
const recordedB64 = 'NjFkZmNjYWFiZjg2YzMwOTAyZDlhMWM3N2I3NDk2OTU4OWY0MDMxZGE0OGU2NDY1OTkyZDllZjlkZjY4YTRmNw==';
const recordedHex = Buffer.from(recordedB64, 'base64').toString('utf8');
console.log('Recorded in java_signed3.xml DigestValue (hex):', recordedHex);

const javaOutput = execSync('java ExtractC14N java_signed3.xml', { encoding: 'utf8' });
const c14nMatch = javaOutput.match(/--- C14N OUTPUT ---\r?\n([\s\S]+?)\r?\n--- END C14N ---/);
if (!c14nMatch) { console.log('Could not extract C14N from Java output'); process.exit(1); }

const c14nStr = c14nMatch[1];
const computedHex = crypto.createHash('sha256').update(c14nStr, 'utf8').digest('hex');
const computedB64 = Buffer.from(computedHex, 'utf8').toString('base64');

console.log('\nJava ExtractC14N output on java_signed3.xml:');
console.log('SHA-256 hex:', computedHex);
console.log('ZATCA-style B64:', computedB64);
console.log('\nRecorded hex:', recordedHex);
console.log('\nSelf-consistency PASSES (computed == recorded):', computedHex === recordedHex);

// Also print what Java's raw SHA-256 Hex line says
const rawMatch = javaOutput.match(/Raw SHA-256 Hex: ([a-f0-9]+)/);
if (rawMatch) console.log('\nJava program also printed Raw SHA-256 Hex:', rawMatch[1]);
