const fs = require('fs');
let content = fs.readFileSync('run_sandbox_onboarding.js', 'utf8');

// Replace console.log and console.error with fs.appendFileSync
content = content.replace(/console\.log\(/g, "require('fs').appendFileSync('onboard.log', require('util').format(");
content = content.replace(/console\.error\(/g, "require('fs').appendFileSync('onboard.log', 'ERROR: ' + require('util').format(");

// We need to add a newline and close the parenthesis
content = content.replace(/require\('fs'\)\.appendFileSync\('onboard\.log', (?:'ERROR: ' \+ )?require\('util'\)\.format\((.*?)\)/g, "require('fs').appendFileSync('onboard.log', require('util').format($1) + '\\n')");

fs.writeFileSync('run_sandbox_onboarding_log2.cjs', content);
