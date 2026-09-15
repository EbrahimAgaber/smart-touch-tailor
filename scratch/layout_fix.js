const fs = require('fs');

let content = fs.readFileSync('src/pages/TailorPOS.jsx', 'utf8');

const s3Start = content.indexOf('{/* Left Column: Customer & Checkout */}');
const s3End = content.indexOf('</main>');
const s3Text = content.substring(s3Start, s3End);

// split s3 into Customer and Checkout
const splitString = '<div className="section-title" style={{ marginTop: \\'0.5rem\\' }}>';
const checkoutIdx = s3Text.indexOf(splitString);

if (checkoutIdx === -1) {
    console.error("Could not find checkout marker");
} else {
    const s3a = s3Text.substring(0, checkoutIdx) + '</section>\\n';
    const s3b = s3Text.substring(checkoutIdx, s3Text.lastIndexOf('</section>'));

    // Now extract section 1 (Preview)
    const s1Start = content.indexOf('{/* Right Column: Live Preview */}');
    const s1End = content.indexOf('{/* Middle Column: Measurements & Type */}');
    const s1Text = content.substring(s1Start, s1End);

    // Now extract section 2 (Measurements)
    const s2Start = s1End;
    const s2End = s3Start;
    const s2Text = content.substring(s2Start, s2End);

    let newCol3 = \`
                {/* Left Column: Checkout & Live Preview */}
                <section className="pos-col print:block">
                    \${s3b}
                    \${s1Text.replace('<section className="pos-col preview-col print:block">', '<div style={{marginTop: "1rem"}} className="print:block">').replace('</section>', '</div>')}
                </section>
\`;

    const newMain = \`
                {/* Right Column: Customer & Meta */}
                \${s3a}
                \${s2Text}
                \${newCol3}
\`;

    const beforeMain = content.substring(0, s1Start);
    const afterMain = content.substring(s3End);

    const finalContent = beforeMain + newMain + afterMain;

    fs.writeFileSync('src/pages/TailorPOS.jsx', finalContent);
    console.log("Successfully rebuilt layout");
}
