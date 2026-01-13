/**
 * Screenshot utility using Puppeteer
 * Takes screenshot of chart HTML for debugging
 */

import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const htmlPath = 'file:///tmp/chart-test.html';
const screenshotPath = './poc/screenshots/chart-latest.png';

console.log('🌐 Launching browser...');
const browser = await puppeteer.launch({
  headless: true,
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1200 });

  console.log(`📄 Opening ${htmlPath}...`);
  await page.goto(htmlPath, { waitUntil: 'networkidle0' });

  // Wait for Plotly to render
  console.log('⏳ Waiting for Plotly to render...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Get console logs
  page.on('console', msg => console.log('Browser console:', msg.text()));

  console.log(`📸 Taking screenshot...`);
  await page.screenshot({
    path: screenshotPath,
    fullPage: true
  });

  console.log(`✅ Screenshot saved: ${screenshotPath}`);
} catch (error) {
  console.error('❌ Error:', error.message);
} finally {
  await browser.close();
}
