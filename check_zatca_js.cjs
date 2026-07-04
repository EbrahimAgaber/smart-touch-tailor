const zatca = require('zatca-xml-js');
console.log(Object.keys(zatca));
console.log(Object.keys(zatca.EGS.prototype || {}));
// Look for sign function
for (const key in zatca) {
    console.log(key, typeof zatca[key]);
}
