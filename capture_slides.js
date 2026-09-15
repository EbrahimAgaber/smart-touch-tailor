const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log("Launching browser...");
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1 // 1920x1080 exact pixels
  });
  
  const filePath = 'c:/my-pos/v2/promo_screens.html';
  const fileUrl = 'file:///' + filePath;
  console.log("Navigating to: " + fileUrl);
  await page.goto(fileUrl, { waitUntil: 'networkidle' });

  // Wait for Google Fonts to fully render
  await page.waitForTimeout(3000);

  const slides = await page.$$('.slide');
  console.log(`Found ${slides.length} slides to capture.`);
  
  let i = 1;
  for (const slide of slides) {
    const filename = `c:/my-pos/v2/slide_0${i}.png`;
    await slide.screenshot({ path: filename });
    console.log(`Captured ${filename}`);
    i++;
  }

  await browser.close();
  console.log("Done!");
})();
