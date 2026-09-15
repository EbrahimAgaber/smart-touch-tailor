const forge = require('node-forge');
const token = "TUlJQ0VEQ0NBYmVnQXdJQkFnSUdBWjhxSlZnWk1Bb0dDQ3FHU000OUJBTUNNQlV4RXpBUkJnTlZCQU1NQ21WSmJuWnZhV05wYm1jd0hoY05Nall3TnpBek1qSTBNVFV6V2hjTk16RXdOekF6TWpFd01EQXdXakJmTVFzd0NRWURWUVFHRXdKVFFURVVNQklHQTFVRUN3d0xTR1ZoWkNCUFptWnBZMlV4SmpBa0JnTlZCQW9NSFUxaGVHbHRkVzBnVTNCbFpXUWdWR1ZqYUNCVGRYQndiSGtnVEZSRU1SSXdFQVlEVlFRRERBbGFRVlJEUVMxRlIxTXdWakFRQmdjcWhrak9QUUlCQmdVcmdRUUFDZ05DQUFTN3lxVC9hTjdnNXgzY0ZuSndTQXdidk5yZ3JiSVFFWXhsZXF0YzlYMzZOTGljMVMyWVB0QjF2S21GRFNxVlAyUHM2alhUUWFXM2I3eHAxdjJydVZFU280R3JNSUdvTUF3R0ExVWRFd0VCL3dRQ01BQXdnWmNHQTFVZEVRU0JqekNCaktTQmlUQ0JoakVrTUNJR0ExVUVCQXdiTVMxVGJXRnlkRlJ2ZFdOb2ZESXRVRTlUZkRNdFVFOVRMVEF4TVI4d0hRWUtDWkltaVpQeUxHUUJBUXdQTXprNU9UazVPVGs1T1RBd01EQXpNUTB3Q3dZRFZRUU1EQVF4TVRBd01SMHdHd1lEVlFRYURCVERtTUtudzVuQ2hNT1l3cm5EbWNLRXc1akNwekVQTUEwR0ExVUVEd3dHVW1WMFlXbHNNQW9HQ0NxR1NNNDlCQU1DQTBjQU1FUUNJQlVZMjl5dUJvY2lVUHY3QVB1K1Zhc2lleCtjZ1RkTHh4Uitic0xKb0FxWkFpQXF6MldlSzRzMnJ2bysyTklOenFpb1NBWk1ZWGNEZjlsQnpoNEc0QXV4U2c9PQ==";
const innerBase64 = Buffer.from(token, 'base64').toString('utf8').replace(/\s+/g, '');
const compCertPem = `-----BEGIN CERTIFICATE-----\n${(innerBase64.match(/.{1,64}/g) || []).join('\n')}\n-----END CERTIFICATE-----`;

const cleanCertBase64 = compCertPem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/[\n\r]/g, '');

const der = forge.util.decode64(cleanCertBase64);

try {
    const obj = forge.asn1.fromDer(der, { strict: false });
    console.log("Success with {strict: false}");
} catch (e) {
    console.error("Error {strict: false}:", e.message);
}

try {
    const obj = forge.asn1.fromDer(der, false);
    console.log("Success with false");
} catch (e) {
    console.error("Error false:", e.message);
}
