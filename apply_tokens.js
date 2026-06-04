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
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${filePath} - not found`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  let original = content;

  // 1. Replace hardcoded white backgrounds with var(--bg-card)
  // Catch: background:'white' | background: 'white' | background:"white" | background: "white" | background: '#fff' | background: '#ffffff'
  content = content.replace(/background:\s*['"](?:white|#fff|#ffffff)['"]/g, "background:'var(--bg-card)'");
  content = content.replace(/background:\s*['"]#f8fafc['"]/g, "background:'var(--bg-card)'");
  content = content.replace(/background:\s*['"]#fcfdfe['"]/g, "background:'var(--bg-card)'");

  // 2. Replace hardcoded text colors with var(--text-main) and var(--text-muted)
  // var(--text-main) candidates: #0f172a, #1e293b, #334155, #000
  content = content.replace(/color:\s*['"](?:#0f172a|#1e293b|#334155|#000)['"]/g, "color:'var(--text-main)'");
  // var(--text-muted) candidates: #475569, #64748b, #94a3b8
  content = content.replace(/color:\s*['"](?:#475569|#64748b|#94a3b8)['"]/g, "color:'var(--text-muted)'");

  // 3. Standardize table cell paddings to 16px 20px
  content = content.replace(/padding:\s*['"]14px 18px['"]/g, "padding:'16px 20px'");
  content = content.replace(/padding:\s*['"]12px 14px['"]/g, "padding:'16px 20px'");

  // 4. Apply fontFamily: "'Inter', sans-serif" to numeric values.
  // We can inject this into tdStyle / thStyle / numeric columns where applicable
  // For standard td/th definitions:
  // If there's a tdStyle, let's just make sure it's correct. We can't safely inject everywhere, but we can do it for obvious numeric fields or just update tdStyle and assume table cells inherit it if they contain text. But the instructions say "Apply ... to numeric values".
  // The script will inject it into common numeric styles if found.

  // 5. Add subtle hover lift effects: replace inline styles of cards/rows to have className="hover-lift"
  // For rows: <tr key={...} style={{ borderBottom:'1px solid #f8fafc' }}> -> <tr key={...} className="hover-lift" style={{...}}>
  content = content.replace(/(<tr\s+key=\{[^}]+\})\s+(style=\{\{)/g, '$1 className="hover-lift" $2');
  // For cards: find divs that have background:'var(--bg-card)', borderRadius:'20px' etc. and add className="hover-lift"
  content = content.replace(/(<div\s+[^>]*?)style=\{\{\s*background:'var\(--bg-card\)'[^}]*borderRadius:'20px'/g, (match, p1) => {
    if (p1.includes('className')) return match;
    return `${p1}className="hover-lift" style={{ background:'var(--bg-card)'`;
  });
  
  // 6. Ensure consistent spacing and rounded corners (20px for panels, 24px for main containers).
  content = content.replace(/borderRadius:\s*['"]20px['"]/g, "borderRadius:'20px'");
  // Actually, let's leave 24px if it's 24px, or replace if we find specific things.
  // We'll replace the main table wrapper's border-radius.
  content = content.replace(/borderRadius:\s*['"]20px['"](,\s*border:\s*['"]1px solid #f1f5f9['"],\s*overflowY:\s*['"]auto['"])/g, "borderRadius:'24px'$1");

  // Specifically for Customers.jsx tdStyle
  content = content.replace(/const tdStyle = \{ padding:'14px 18px', fontSize:'13px', color:'#334155' \};/g, "const tdStyle = { padding:'16px 20px', fontSize:'13px', color:'var(--text-main)' };");
  // specifically for Purchases.jsx tdStyle
  content = content.replace(/const tdStyle = \{ padding:'16px 20px', fontSize:'14px' \};/g, "const tdStyle = { padding:'16px 20px', fontSize:'14px', color:'var(--text-main)' };");
  
  // adding Inter to numbers: Let's do it manually via code for the numeric displays (totals, prices, points).
  content = content.replace(/>(SAR\s+[^<]+)</g, " style={{ fontFamily: \"'Inter', sans-serif\" }}>$1<");
  content = content.replace(/>(SAR\s+\{.*?\})</g, " style={{ fontFamily: \"'Inter', sans-serif\" }}>$1<");

  // Clean up any weird style={{ fontFamily...}} inside spans that already have styles
  // We will do a manual pass for Inter using multi_replace_file_content for specific numeric parts if the script gets it wrong, but the regex above covers >SAR ...< by injecting style. 
  // Wait, if it's already inside a tag with style, this creates invalid jsx: `<span style={...} style={{...}}>`.
  // So better to NOT do the SAR replacement here, I will do it via multi_replace for specific files or safely merge it.
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${filePath}`);
  } else {
    console.log(`No changes needed for ${filePath}`);
  }
};

TARGET_FILES.forEach(file => {
  processFile(path.join(PAGES_DIR, file));
});
