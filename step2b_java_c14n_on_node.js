/**
 * Deep Step 2 part 2: Check if the ZATCA Java SDK uses a DIFFERENT encoding scheme
 * for the DigestValue.
 *
 * Standard XMLDSig: DigestValue = Base64(raw_sha256_bytes)
 * ZATCA's pattern: DigestValue = Base64(hex_string_of_sha256_bytes)  (double encoded)
 *
 * We've confirmed the java_signed3.xml was signed by the Java SDK.
 * The recorded DigestValue decodes to a hex string: 61dfccaa...
 * This suggests ZATCA is using: DigestValue = base64(hex(sha256(input)))
 *
 * So we need to find: what input X satisfies sha256(X) == 61dfccaabf86c30902d9a1c77b74969589f4031da48e6465992d9ef9df68a4f7
 *
 * Let's try the ExclusiveC14N output from the Java process (captured earlier).
 */
const fs = require('fs');
const crypto = require('crypto');
const xpath = require('xpath');
const { DOMParser } = require('@xmldom/xmldom');
const xmlcrypto = require('xml-crypto');

const javaXml = fs.readFileSync('java_signed3.xml', 'utf8');
const doc = new DOMParser().parseFromString(javaXml, 'application/xml');
const spNode = xpath.select("//*[local-name()='SignedProperties']", doc)[0];

// The target: raw SHA-256 hash we need to reproduce
const targetHex = '61dfccaabf86c30902d9a1c77b74969589f4031da48e6465992d9ef9df68a4f7';

function testInput(label, str) {
    // Standard: sha256(bytes of str)
    const hashHex = crypto.createHash('sha256').update(str, 'utf8').digest('hex');
    if (hashHex === targetHex) {
        console.log(`\n*** MATCH *** [${label}]`);
        console.log('Input was:');
        console.log(str.substring(0, 500));
        fs.writeFileSync(`winning_input_${label.replace(/\W/g, '_')}.xml`, str);
        return true;
    }
    return false;
}

// The Java ExtractC14N output we captured earlier shows what Java's C14N produces:
// We got it from running: java ExtractC14N java_signed3.xml > java_standard_c14n.xml
// But that file was UTF-16LE. Let's read it as binary and convert.
try {
    const c14nBuf = fs.readFileSync('java_standard_c14n.xml');
    // Check BOM
    if (c14nBuf[0] === 0xFF && c14nBuf[1] === 0xFE) {
        console.log('java_standard_c14n.xml is UTF-16LE');
        const utf16Str = c14nBuf.slice(2).toString('utf16le');
        // Extract just the C14N output part
        const c14nMatch = utf16Str.match(/--- C14N OUTPUT ---\r?\n([\s\S]+?)\r?\n--- END C14N ---/);
        if (c14nMatch) {
            const c14nStr = c14nMatch[1];
            console.log('Extracted C14N length:', c14nStr.length);
            testInput('Java-captured-C14N', c14nStr);
            testInput('Java-captured-C14N LF->CRLF', c14nStr.replace(/\n/g, '\r\n'));
        }
    } else {
        const utf8Str = c14nBuf.toString('utf8');
        const c14nMatch = utf8Str.match(/--- C14N OUTPUT ---\r?\n([\s\S]+?)\r?\n--- END C14N ---/);
        if (c14nMatch) {
            const c14nStr = c14nMatch[1];
            console.log('java_standard_c14n.xml is UTF-8, C14N length:', c14nStr.length);
            testInput('Java-captured-C14N', c14nStr);
            testInput('Java-captured-C14N LF->CRLF', c14nStr.replace(/\n/g, '\r\n'));
            testInput('Java-captured-C14N CRLF->LF', c14nStr.replace(/\r\n/g, '\n'));
        }
    }
} catch(e) {
    console.log('Could not read java_standard_c14n.xml:', e.message);
}

// The Java program printed it with SHA-256 Hex: f1bb806622ebf3ae561d7525eb86dc6e7d11d25acd49ec4e09370358a3bab7bf
// BUT that's when run on java_signed3.xml — the file signed with a DIFFERENT key/cert!
// Let's verify: the java_signed3.xml was signed by ZATCA SDK with a different cert+timestamp
// than our node output. So the content IS different. This is expected.

// The real question is: on node_signed_exact.xml (our patched output),
// what does the Java ExtractC14N produce?

console.log('\n--- Running Java ExtractC14N on node_signed_exact.xml ---');
const { execSync } = require('child_process');
try {
    const javaOutput = execSync('java ExtractC14N node_signed_exact.xml', { encoding: 'utf8' });
    console.log(javaOutput);

    // Extract C14N string from output  
    const c14nMatch = javaOutput.match(/--- C14N OUTPUT ---\r?\n([\s\S]+?)\r?\n--- END C14N ---/);
    if (c14nMatch) {
        const c14nStr = c14nMatch[1];
        console.log('\nExtracted C14N from node_signed_exact.xml:');
        console.log('Length:', c14nStr.length);
        const h = crypto.createHash('sha256').update(c14nStr, 'utf8').digest('hex');
        const b64 = Buffer.from(h, 'utf8').toString('base64');
        console.log('SHA-256 hex:', h);
        console.log('ZATCA-style B64:', b64);

        // Compare to the DigestValue currently in node_signed_exact.xml
        const nodeXml = fs.readFileSync('node_signed_exact.xml', 'utf8');
        const nodeDigestMatch = nodeXml.match(/URI="#xadesSignedProperties"[\s\S]*?<ds:DigestValue>([^<]+)<\/ds:DigestValue>/);
        const recordedInNode = nodeDigestMatch ? nodeDigestMatch[1].trim() : 'NOT FOUND';
        console.log('\nRecorded in node_signed_exact.xml:', recordedInNode);
        console.log('What SHOULD be there:', b64);
        console.log('Match:', b64 === recordedInNode);
    }
} catch(e) {
    console.log('Java execution error:', e.message);
}
