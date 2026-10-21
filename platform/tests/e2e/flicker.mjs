// Navigation smoothness on a slow mobile connection, first visit to every page.
import { chromium } from 'playwright';
const url = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => { try { localStorage.setItem('lang', 'en'); sessionStorage.setItem('installPromptDismissed', '1'); } catch { /* storage blocked */ } });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await page.goto(url);
await page.waitForSelector('.login-card form');
const i = page.locator('.login-card form input');
await i.nth(0).fill('admin@kcp.iq'); await i.nth(1).fill('Admin12345');
await page.click('.login-card form button.primary');
await page.waitForSelector('.sidebar .brand', { timeout: 30000 });
// ~3G: 300 ms latency, 1.6 Mbit/s down
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 300, downloadThroughput: 200_000, uploadThroughput: 90_000 });
await page.waitForTimeout(Number(process.env.IDLE ?? 4000)); // a user reading the dashboard
await page.evaluate(() => {
  window.__f = { sidebarGone: 0, spinner: 0 };
  new MutationObserver(() => {
    if (!document.querySelector('.sidebar .brand')) window.__f.sidebarGone++;
    const sp = document.querySelector('.center-screen');
    if (sp && getComputedStyle(sp).visibility === 'visible') window.__f.spinner++;
  }).observe(document.body, { childList: true, subtree: true, attributes: true });
});
for (const label of ['Waiting in your pool', 'Inspections', 'Equipment', 'Reports', 'Documents & SOP', 'Guide & Tips', 'Users', 'Devices', 'Audit Log', 'Settings']) {
  await page.locator('.sidebar .nav-link', { hasText: label }).first().click();
  await page.waitForSelector('.content h1', { timeout: 30000 });
  await page.waitForTimeout(300);
}
const f = await page.evaluate(() => window.__f);
console.log((f.sidebarGone === 0 && f.spinner === 0 ? 'PASS' : 'FAIL') + ' slow network, 10 first-time page visits: ' + JSON.stringify(f));
await browser.close();
