const { _electron: electron } = require('playwright');
const path = require('path');

async function runTests() {
  console.log('Launching Electron app...');
  const electronApp = await electron.launch({
    args: ['.'],
    cwd: path.join(__dirname, '..')
  });

  try {
    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    console.log('App loaded.');

    try {
        await window.waitForSelector('.pin-pad', { timeout: 3000 });
        console.log('Pin pad detected, entering pin 1234');
        await window.click('button:has-text("1")');
        await window.click('button:has-text("2")');
        await window.click('button:has-text("3")');
        await window.click('button:has-text("4")');
        await window.click('button:has-text("دخول")');
    } catch (e) {
        console.log('No pin pad found, assuming already logged in');
    }

    await window.waitForTimeout(1500);

    console.log('Navigating to Tailor POS...');
    await window.evaluate(() => {
        window.location.hash = '#/tailor-pos';
    });

    await window.waitForTimeout(2000);

    console.log('Running Scenario 7 (Draft Order)...');
    await window.fill('input[placeholder="05xxxxxxxx"]', '0501234567');
    await window.fill('input[placeholder="أدخل اسم العميل"]', 'Draft Customer');

    await window.evaluate(() => {
       const lengths = Array.from(document.querySelectorAll('input[placeholder="0"]'));
       lengths.forEach(l => {
           l.value = '60';
           l.dispatchEvent(new Event('input', { bubbles: true }));
       });
    });

    await window.click('button:has-text("حفظ كمسودة")');
    await window.waitForTimeout(1500);
    console.log('Draft saved.');

    console.log('Running Scenario 8 (Quote)...');
    
    await window.evaluate(() => {
        window.location.reload();
    });
    
    await window.waitForTimeout(3000);
    
    await window.fill('input[placeholder="05xxxxxxxx"]', '0501234568');
    await window.fill('input[placeholder="أدخل اسم العميل"]', 'Quote Customer');

    for(let i=0; i<4; i++) {
       await window.click('button:has-text("+ إضافة قطعة")');
    }
    
    await window.evaluate(() => {
       const lengths = Array.from(document.querySelectorAll('input[placeholder="0"]'));
       lengths.forEach(l => {
           l.value = '60';
           l.dispatchEvent(new Event('input', { bubbles: true }));
       });
    });

    await window.click('button:has-text("طباعة عرض سعر")');
    await window.waitForTimeout(1500);
    console.log('Quote printed.');

    console.log('✅ Scenarios 7 & 8 executed in automated test.');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await electronApp.close();
  }
}

runTests();
