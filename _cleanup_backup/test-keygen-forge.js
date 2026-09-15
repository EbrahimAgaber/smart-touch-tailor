// Prove that elliptic-generated keys encode correctly to PKCS#8 and SPKI PEM
// and that extractPrivateKeyHex can round-trip them back

const EC = require('elliptic').ec;
const forge = require('node-forge');
const crypto = require('crypto');
const fs = require('fs');

const ec = new EC('secp256k1');

// OIDs as DER bytes (fixed for secp256k1)
// ecPublicKey = 1.2.840.10045.2.1
// secp256k1   = 1.3.132.0.10
const asn1 = forge.asn1;

function buildPrivateKeyPKCS8(dHex, uncompressedPubHex) {
    // ECPrivateKey (RFC 5915):
    //   SEQUENCE {
    //     INTEGER 1
    //     OCTET STRING <d>
    //     [1] BIT STRING <uncompressed point>
    //   }
    const dBuf = Buffer.from(dHex, 'hex');
    const pubBuf = Buffer.from(uncompressedPubHex, 'hex');

    const ecPrivateKey = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, String.fromCharCode(0x01)),
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, forge.util.createBuffer(dBuf).getBytes()),
        asn1.create(asn1.Class.CONTEXT_SPECIFIC, 1, true, [
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.BITSTRING, false,
                String.fromCharCode(0x00) + forge.util.createBuffer(pubBuf).getBytes()
            ),
        ]),
    ]);

    const ecPrivateKeyDer = asn1.toDer(ecPrivateKey).getBytes();

    // PKCS#8 PrivateKeyInfo:
    //   SEQUENCE {
    //     INTEGER 0
    //     SEQUENCE { OID ecPublicKey, OID secp256k1 }
    //     OCTET STRING <ECPrivateKey DER>
    //   }
    const pkcs8 = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, String.fromCharCode(0x00)),
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false,
                asn1.oidToDer('1.2.840.10045.2.1').getBytes()),  // ecPublicKey
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false,
                asn1.oidToDer('1.3.132.0.10').getBytes()),        // secp256k1
        ]),
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, ecPrivateKeyDer),
    ]);

    const der = asn1.toDer(pkcs8).getBytes();
    return forge.pem.encode({ type: 'PRIVATE KEY', body: der });
}

function buildPublicKeySPKI(uncompressedPubHex) {
    const pubBuf = Buffer.from(uncompressedPubHex, 'hex');

    // SubjectPublicKeyInfo:
    //   SEQUENCE {
    //     SEQUENCE { OID ecPublicKey, OID secp256k1 }
    //     BIT STRING <uncompressed point>
    //   }
    const spki = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false,
                asn1.oidToDer('1.2.840.10045.2.1').getBytes()),
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false,
                asn1.oidToDer('1.3.132.0.10').getBytes()),
        ]),
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.BITSTRING, false,
            String.fromCharCode(0x00) + forge.util.createBuffer(pubBuf).getBytes()
        ),
    ]);

    const der = asn1.toDer(spki).getBytes();
    return forge.pem.encode({ type: 'PUBLIC KEY', body: der });
}

// Generate keypair with elliptic
const keyPair = ec.genKeyPair();
const dHex = keyPair.getPrivate('hex').padStart(64, '0');
const pubPoint = keyPair.getPublic();
const uncompressedHex = pubPoint.encode('hex', false); // 04 + x + y

console.log('dHex length:', dHex.length);
console.log('uncompressed pub hex length:', uncompressedHex.length);

const privateKeyPem = buildPrivateKeyPKCS8(dHex, uncompressedHex);
const publicKeyPem  = buildPublicKeySPKI(uncompressedHex);

fs.writeFileSync('elliptic_priv.pem', privateKeyPem);
fs.writeFileSync('elliptic_pub.pem', publicKeyPem);

console.log('\nPrivate key PEM:\n', privateKeyPem.slice(0, 80));
console.log('Public key PEM:\n', publicKeyPem.slice(0, 80));

// Round-trip: extractPrivateKeyHex should recover dHex
function extractPrivateKeyHex(pem) {
    const msg = forge.pem.decode(pem)[0];
    const asn1Obj = forge.asn1.fromDer(msg.body);
    if (asn1Obj.value[1].type === forge.asn1.Type.SEQUENCE && asn1Obj.value[2].type === forge.asn1.Type.OCTETSTRING) {
        const ecPrivateKeyAsn1 = forge.asn1.fromDer(asn1Obj.value[2].value);
        return forge.util.bytesToHex(ecPrivateKeyAsn1.value[1].value);
    } else if (asn1Obj.value[1].type === forge.asn1.Type.OCTETSTRING) {
        return forge.util.bytesToHex(asn1Obj.value[1].value);
    }
    throw new Error('Unsupported PEM format');
}

const recoveredD = extractPrivateKeyHex(privateKeyPem);
console.log('\nRound-trip D match:', recoveredD === dHex);
