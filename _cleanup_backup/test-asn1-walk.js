const forge = require('node-forge');

const token = "TUlJQ0VEQ0NBYmVnQXdJQkFnSUdBWjhxSlZnWk1Bb0dDQ3FHU000OUJBTUNNQlV4RXpBUkJnTlZCQU1NQ21WSmJuWnZhV05wYm1jd0hoY05Nall3TnpBek1qSTBNVFV6V2hjTk16RXdOekF6TWpFd01EQXdXakJmTVFzd0NRWURWUVFHRXdKVFFURVVNQklHQTFVRUN3d0xTR1ZoWkNCUFptWnBZMlV4SmpBa0JnTlZCQW9NSFUxaGVHbHRkVzBnVTNCbFpXUWdWR1ZqYUNCVGRYQndiSGtnVEZSRU1SSXdFQVlEVlFRRERBbGFRVlJEUVMxRlIxTXdWakFRQmdjcWhrak9QUUlCQmdVcmdRUUFDZ05DQUFTN3lxVC9hTjdnNXgzY0ZuSndTQXdidk5yZ3JiSVFFWXhsZXF0YzlYMzZOTGljMVMyWVB0QjF2S21GRFNxVlAyUHM2alhUUWFXM2I3eHAxdjJydVZFU280R3JNSUdvTUF3R0ExVWRFd0VCL3dRQ01BQXdnWmNHQTFVZEVRU0JqekNCaktTQmlUQ0JoakVrTUNJR0ExVUVCQXdiTVMxVGJXRnlkRlJ2ZFdOb2ZESXRVRTlUZkRNdFVFOVRMVEF4TVI4d0hRWUtDWkltaVpQeUxHUUJBUXdQTXprNU9UazVPVGs1T1RBd01EQXpNUTB3Q3dZRFZRUU1EQVF4TVRBd01SMHdHd1lEVlFRYURCVERtTUtudzVuQ2hNT1l3cm5EbWNLRXc1akNwekVQTUEwR0ExVUVEd3dHVW1WMFlXbHNNQW9HQ0NxR1NNNDlCQU1DQTBjQU1FUUNJQlVZMjl5dUJvY2lVUHY3QVB1K1Zhc2lleCtjZ1RkTHh4Uitic0xKb0FxWkFpQXF6MldlSzRzMnJ2bysyTklOenFpb1NBWk1ZWGNEZjlsQnpoNEc0QXV4U2c9PQ==";
const innerBase64 = Buffer.from(token, 'base64').toString('utf8').replace(/\s+/g, '');

const der = forge.util.decode64(innerBase64);
const obj = forge.asn1.fromDer(der);

const tbs = obj.value[0];
let serialHex = '';
let issuerSeq = null;

// The structure of TBSCertificate:
// [0] Version (EXPLICIT, Context-specific tag 0) - optional
// [1] SerialNumber (INTEGER)
// [2] Signature (SEQUENCE)
// [3] Issuer (SEQUENCE)

let idx = 0;
if (tbs.value[idx].tagClass === forge.asn1.Class.CONTEXT_SPECIFIC) {
    idx++; // skip version
}
// Serial Number
const serialObj = tbs.value[idx++];
serialHex = forge.util.bytesToHex(serialObj.value);
// skip signature
idx++;
// Issuer
issuerSeq = tbs.value[idx++];

// Format Issuer sequence into string
// Issuer is a SEQUENCE of SETs of SEQUENCEs of OID and Value
const rdns = [];
const oidMap = {
    '2.5.4.3': 'CN',
    '2.5.4.6': 'C',
    '2.5.4.7': 'L',
    '2.5.4.8': 'ST',
    '2.5.4.10': 'O',
    '2.5.4.11': 'OU',
};

for (const set of issuerSeq.value) {
    for (const seq of set.value) {
        const oid = forge.asn1.derToOid(seq.value[0].value);
        const valObj = seq.value[1];
        let val = valObj.value;
        if (valObj.type === forge.asn1.Type.UTF8) {
            val = forge.util.decodeUtf8(val);
        }
        const key = oidMap[oid] || oid;
        rdns.push(`${key}=${val}`);
    }
}
const issuerString = rdns.reverse().join(', ');

console.log('Serial:', BigInt('0x' + serialHex).toString(10));
console.log('Issuer:', issuerString);
