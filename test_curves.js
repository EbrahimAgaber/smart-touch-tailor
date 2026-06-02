const crypto = require('crypto');
console.log(crypto.getCurves().filter(c => c.includes('secp')));
