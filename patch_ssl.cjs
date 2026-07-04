const fs = require('fs');
const p = 'node_modules/zatca-xml-js/lib/zatca/egs/index.js';
let c = fs.readFileSync(p, 'utf8');
c = c.replace('command.stdout.on("data", (data) => {', 
    'command.stderr.on("data", (d) => console.error("SSL ERR:", d.toString())); command.stdout.on("data", (data) => {');
fs.writeFileSync(p, c);
console.log('patched');
