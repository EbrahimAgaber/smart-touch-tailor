const crypto = require('crypto');

const base64 = "TUlJQ1BEQ0NBZU9nQXdJQkFnSUdBWjhGamx2RE1Bb0dDQ3FHU000OUJBTUNNQlV4RXpBUkJnTlZCQU1NQ21WSmJuWnZhV05wYm1jd0hoY05Nall3TmpJMk1qQXhNRE00V2hjTk16RXdOakkxTWpFd01EQXdXakIxTVFzd0NRWURWUVFHRXdKVFFURVdNQlFHQTFVRUN3d05VbWw1WVdSb0lFSnlZVzVqYURFbU1DUUdBMVVFQ2d3ZFRXRjRhVzExYlNCVGNHVmxaQ0JVWldOb0lGTjFjSEJzZVNCTVZFUXhKakFrQmdOVkJBTU1IVlJUVkMwNE9EWTBNekV4TkRVdE16azVPVGs1T1RrNU9UQXdNREF6TUZZd0VBWUhLb1pJemowQ0FRWUZLNEVFQUFvRFFnQUVUd0o0em9ac1NrU2NtZnVXdEU3ZHhBcVhWOG9Da2daL21TV2F5ZVJmTTh0VGlpcVdXR3pUcG01L0Rsc2R1Ykh5cFQ1QW5YTjlIWFRKcWdGM1l5SldGcU9Cd1RDQnZqQU1CZ05WSFJNQkFmOEVBakFBTUlHdEJnTlZIUkVFZ2FVd2dhS2tnWjh3Z1p3eE96QTVCZ05WQkFRTU1qRXRWRk5VZkRJdFZGTlVmRE10WldReU1tWXhaRGd0WlRaaE1pMHhNVEU0TFRsaU5UZ3RaRGxoT0dZeE1XVTBORFZtTVI4d0hRWUtDWkltaVpQeUxHUUJBUXdQTXprNU9UazVPVGs1T1RBd01EQXpNUTB3Q3dZRFZRUU1EQVF4TVRBd01SRXdEd1lEVlFRYURBaFNVbEpFTWpreU9URWFNQmdHQTFVRUR3d1JVM1Z3Y0d4NUlHRmpkR2wyYVhScFpYTXdDZ1lJS29aSXpqMEVBd0lEUndBd1JBSWdLTUEvZm5ZQno4ZFZKcVlWMXBJQ3pLQnpsdDhZNGI3dDZHWHhCTWR0K3NJQ0lGTE1JSzJLNnJvU3FoNWdrc3hyQkJmTVQ4NHY5YzU0SUQwWXhBais1ZWVO";

try {
    let token = base64;
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    if (decoded.trim().startsWith('MII')) {
        console.log('Double base64 detected!');
        token = decoded.trim();
    }
    const certPem = `-----BEGIN CERTIFICATE-----\n${token}\n-----END CERTIFICATE-----`;
    const x509 = new crypto.X509Certificate(certPem);
    console.log("Issuer:", x509.issuer);
    console.log("Serial number:", x509.serialNumber);
    const snHex = x509.serialNumber.replace(/:/g, '');
    console.log("SN Hex:", snHex);
    console.log("BigInt SN:", BigInt('0x' + snHex).toString(10));
} catch (e) {
    console.error("Parse failed:", e);
}
