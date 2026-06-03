const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  page.on('requestfailed', req => console.log('REQ FAILED:', req.url(), req.failure().errorText));

  console.log('Navigating to http://localhost:3001/login ...');
  try {
    await page.goto('http://localhost:3001/login', { waitUntil: 'networkidle2', timeout: 15000 });
  } catch(e) {
    console.log('Navigation error:', e.message);
  }
  
  await new Promise(r => setTimeout(r, 3000));

  // Get the page content
  const bodyHTML = await page.evaluate(() => document.body.innerHTML);
  console.log('\n=== BODY HTML (first 2000 chars) ===');
  console.log(bodyHTML.substring(0, 2000));
  
  // Check for React root
  const rootContent = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root ? root.innerHTML.substring(0, 500) : 'NO ROOT ELEMENT';
  });
  console.log('\n=== #root innerHTML (first 500 chars) ===');
  console.log(rootContent);

  // Check computed styles on body
  const bodyStyles = await page.evaluate(() => {
    const body = document.body;
    const cs = getComputedStyle(body);
    return {
      bgColor: cs.backgroundColor,
      color: cs.color,
      fontFamily: cs.fontFamily,
      dataTheme: document.documentElement.getAttribute('data-theme'),
      childCount: document.getElementById('root')?.childElementCount || 0,
    };
  });
  console.log('\n=== Body computed styles ===');
  console.log(JSON.stringify(bodyStyles, null, 2));

  // Take screenshot
  await page.screenshot({ path: 'C:\\Users\\Sistemas\\CRM\\crm\\frontend\\debug_screenshot.png', fullPage: true });
  console.log('\nScreenshot saved to debug_screenshot.png');

  await browser.close();
})();
