import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function capturePosters() {
    console.log('Starting puppeteer...');
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Set a large viewport
    await page.setViewport({ width: 1200, height: 5000 });
    
    // Load the HTML file
    const fileUrl = `file://${path.join(__dirname, 'poster_generator.html')}`;
    console.log(`Loading ${fileUrl}...`);
    await page.goto(fileUrl, { waitUntil: 'networkidle0' });

    // Wait for the fonts to load
    await page.evaluateHandle('document.fonts.ready');
    
    // Let Tailwind render completely
    await new Promise(r => setTimeout(r, 2000));

    // Capture each poster
    for (let i = 1; i <= 4; i++) {
        const selector = `#poster-${i}`;
        const element = await page.$(selector);
        
        if (element) {
            const outputPath = path.join(__dirname, `promo_${i}.png`);
            await element.screenshot({ path: outputPath });
            console.log(`Saved ${outputPath}`);
        } else {
            console.error(`Poster ${i} not found!`);
        }
    }

    await browser.close();
    console.log('Done!');
}

capturePosters().catch(console.error);
