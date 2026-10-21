// Pop-ups must sit above the sidebar in both languages (and with the animated background behind everything).
import { chromium } from 'playwright';
const url = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
const browser = await chromium.launch();
let ok = true;
for (const lang of ['en', 'ar']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(l => { try { localStorage.setItem('lang', l); sessionStorage.setItem('installPromptDismissed', '1'); } catch { /* storage blocked */ } }, lang);
  const page = await ctx.newPage();
  await page.goto(url); await page.waitForSelector('.login-card form');
  const i = page.locator('.login-card form input');
  await i.nth(0).fill('admin@kcp.iq'); await i.nth(1).fill('Admin12345'); await page.click('.login-card form button.primary');
  await page.waitForSelector('.sidebar .brand');
  await page.goto(new URL('/users', url).href); await page.waitForSelector('.content .lrow');
  await page.locator('.page-head .btn.primary').click(); await page.waitForSelector('.modal');
  const r = await page.evaluate(() => {
    const m = document.querySelector('.modal').getBoundingClientRect(), s = document.querySelector('.sidebar').getBoundingClientRect();
    const at = (x, y) => document.elementFromPoint(x, y);
    return {
      modalEdges: [at(m.left + 8, m.top + 60), at(m.right - 8, m.top + 60)].every(e => e && e.closest('.modal')),
      overSidebar: !!at(s.left + s.width / 2, s.top + 200)?.closest('.overlay'),
      contentClickable: true,
    };
  });
  await page.keyboard.press('Escape');
  const behind = await page.evaluate(() => { const e = document.elementFromPoint(700, 400); return !e.closest('.app-bg'); });
  const pass = r.modalEdges && r.overSidebar && behind;
  if (!pass) ok = false;
  console.log(`${pass ? 'PASS' : 'FAIL'} [${lang}] pop-up fully visible: ${r.modalEdges}, backdrop covers sidebar: ${r.overSidebar}, background stays behind content: ${behind}`);
  await ctx.close();
}
await browser.close();
process.exit(ok ? 0 : 1);
