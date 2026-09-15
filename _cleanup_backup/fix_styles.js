const fs = require('fs');
const path = require('path');

const TARGET_FILES = [
  'Customers.jsx',
  'Expenditures.jsx',
  'Stock.jsx',
  'Suppliers.jsx',
  'Purchases.jsx',
  'Staff.jsx',
  'AuditLogs.jsx',
  'Promotions.jsx'
];

const PAGES_DIR = path.join(__dirname, 'src', 'pages');

const processFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf-8');
  let original = content;

  // Find overlapping style objects and merge them.
  // We're specifically looking for:
  // style={{ ... }} style={{ fontFamily: "'Inter', sans-serif" }}
  // which might be repeated multiple times.
  
  // First, collapse repeated exact same style tags injected by mistake:
  content = content.replace(/style=\{\{\s*fontFamily:\s*"'Inter',\s*sans-serif"\s*\}\}\s*style=\{\{\s*fontFamily:\s*"'Inter',\s*sans-serif"\s*\}\}/g, "style={{ fontFamily: \"'Inter', sans-serif\" }}");
  content = content.replace(/style=\{\{\s*fontFamily:\s*"'Inter',\s*sans-serif"\s*\}\}\s*style=\{\{\s*fontFamily:\s*"'Inter',\s*sans-serif"\s*\}\}/g, "style={{ fontFamily: \"'Inter', sans-serif\" }}");
  
  // Now merge `style={{ foo: 'bar' }}` with `style={{ fontFamily: "'Inter', sans-serif" }}`
  // Regex matches style={{ <anything not containing closing brackets but maybe nested?> }} style={{ fontFamily... }}
  // Since JSX styles don't usually have deeply nested objects inline, we can safely match non-braces inside.
  // Wait, some might have {{ ...spread, ... }} but usually it's simple object.
  // A safe regex: style=\{\{(.*?)\}\}\s*style=\{\{\s*fontFamily:\s*"'Inter',\s*sans-serif"\s*\}\}
  // This might match `style={{ fontWeight: '700' }} style={{ fontFamily: "'Inter', sans-serif" }}`
  // and we want to turn it into `style={{ $1, fontFamily: "'Inter', sans-serif" }}`
  
  // Loop until no more matches
  let prev;
  do {
    prev = content;
    content = content.replace(/style=\{\{([^{}]+)\}\}\s*style=\{\{\s*fontFamily:\s*"'Inter',\s*sans-serif"\s*\}\}/g, "style={{$1, fontFamily: \"'Inter', sans-serif\"}}");
  } while (content !== prev);

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Fixed styles in ${filePath}`);
  }
};

TARGET_FILES.forEach(file => {
  processFile(path.join(PAGES_DIR, file));
});
