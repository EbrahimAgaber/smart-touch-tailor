const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const OUT_DIR = 'C:/my-pos/product_image/svgs';
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const routes = [
  'dashboard', 'pos', 'finance-hub', 'finance-hub-p2', 'sales-history', 
  'stock', 'purchases', 'suppliers', 'expenditures', 'settings', 
  'audit-logs', 'customers', 'promotions', 'kds', 'live-orders'
];

async function run() {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();

  console.log("Navigating to local app...");
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle2' });

  console.log("Injecting Auth...");
  await page.evaluate(() => {
    localStorage.setItem('activeRole', 'Admin');
    localStorage.setItem('currentUser', JSON.stringify({
      id: 1, 
      name: 'Admin User', 
      role: 'Admin', 
      permissions: ['reports', 'accounts', 'stock', 'settings', 'customers']
    }));
  });
  console.log("Reloading so state manager picks up auth...");
  await page.reload({ waitUntil: 'networkidle0' });

  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    console.log(`Processing route: /${route} (${i+1}/${routes.length})`);
    
    // Navigate to route
    await page.goto(`http://127.0.0.1:5173/#/${route}`, { waitUntil: 'networkidle0' });
    
    // Give it a moment to render charts and fetch data
    await new Promise(r => setTimeout(r, 2000));

    // Capture Base UI (Sidebar/Header visible, Main hidden)
    await page.evaluate(() => {
      const main = document.querySelector('main');
      if (main) main.style.opacity = '0';
      // If there is a license banner, hide it as well so it doesn't clutter the promo
      const banners = document.querySelectorAll('div[style*="z-index: 10000"]');
      banners.forEach(b => b.style.opacity = '0');
    });
    
    await page.screenshot({ 
      path: path.join(OUT_DIR, `${i+1}_base.png`), 
      omitBackground: true 
    });

    // Capture Content UI (Sidebar/Header hidden, Main visible)
    await page.evaluate(() => {
      const main = document.querySelector('main');
      const sidebar = document.querySelector('.app-sidebar');
      const hamburger = document.querySelector('.sidebar-hamburger');
      
      if (main) main.style.opacity = '1';
      if (sidebar) sidebar.style.opacity = '0';
      if (hamburger) hamburger.style.opacity = '0';
    });

    await page.screenshot({ 
      path: path.join(OUT_DIR, `${i+1}_content.png`), 
      omitBackground: true 
    });

    // Reset visibility for next route
    await page.evaluate(() => {
      const sidebar = document.querySelector('.app-sidebar');
      const hamburger = document.querySelector('.sidebar-hamburger');
      if (sidebar) sidebar.style.opacity = '1';
      if (hamburger) hamburger.style.opacity = '1';
    });
  }

  console.log("Finished capturing all layers!");
  await browser.close();
}

run().catch(console.error);
