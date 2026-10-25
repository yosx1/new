// Emulator E2E: admin adds users from the platform (new account + invitation for an existing login).
import { chromium } from 'playwright';

const url = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
const AUTH = 'http://127.0.0.1:9099';
const P = 'demo-coldrun';
let ok = true;
const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
const errors = [];

await fetch(`${AUTH}/emulator/v1/projects/${P}/accounts`, { method: 'DELETE' });
await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${P}/databases/(default)/documents`, { method: 'DELETE' });
// Someone who already has a (verified) login before the administrator adds them, e.g. via Google.
const su = await (await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=x`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'pre@kcml.iq', password: 'PreExist123', returnSecureToken: true }),
})).json();
await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${P}/accounts:update`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }, body: JSON.stringify({ localId: su.localId, emailVerified: true }),
});

const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.addInitScript(() => { try { localStorage.setItem('lang', 'en'); sessionStorage.setItem('installPromptDismissed', '1'); } catch { /* storage blocked */ } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (/invite|PERMISSION|permission/i.test(m.text())) console.log('CONSOLE', m.type(), m.text().slice(0, 300)); }); page.on('response', r => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url().slice(0, 110)); });
// The one expected 400 is sign-up answering "e-mail already in use" for the person who already had a login.
page.on('console', m => { if (m.type() === 'error' && !/apis\.google\.com|ERR_TUNNEL/.test(m.text()) && !(/status of 400/.test(m.text()) && /accounts:signUp/.test(m.location().url))) errors.push(m.text()); });

await page.goto(url);
await page.waitForSelector('.login-card form');
const inp = page.locator('.login-card form input');
await inp.nth(0).fill('Admin'); await inp.nth(1).fill('admin@kcml.iq'); await inp.nth(2).fill('Admin12345');
await page.click('.login-card form button.primary');
await page.waitForSelector('.sidebar .brand', { timeout: 20000 });

const addUser = async (name, email, role) => {
  await page.goto(new URL('/users', url).href);
  await page.waitForSelector('.content .lrow', { timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Add user' }).click();
  const m = page.locator('.modal');
  await m.waitFor();
  await m.locator('input').nth(0).fill(name);
  await m.locator('input[type=email]').fill(email);
  const [r, d] = role.split(':');
  await m.locator('select').first().selectOption(r);
  if (d) await m.locator('select').nth(1).selectOption(d);
  await page.waitForTimeout(300);
  await m.getByRole('button', { name: 'Save' }).click();
  await page.waitForSelector('.toast', { timeout: 15000 });
  return page.textContent('.toast');
};

// Typing key by key (like a person) must keep the cursor in the field being typed in.
await page.goto(new URL('/users', url).href);
await page.waitForSelector('.content .lrow', { timeout: 20000 });
await page.getByRole('button', { name: 'Add user' }).click();
const mm = page.locator('.modal');
await mm.locator('input').nth(0).click(); await page.keyboard.type('Sara Typed', { delay: 30 });
await mm.locator('input[type=email]').click(); await page.keyboard.type('sara@kcml.iq', { delay: 30 });
await mm.locator('input[type=tel]').click(); await page.keyboard.type('07700000000', { delay: 30 });
const vals = await mm.locator('input').evaluateAll(els => els.map(e => e.value));
check(vals[0] === 'Sara Typed' && vals[1] === 'sara@kcml.iq' && vals.includes('07700000000'), `typing stays in each field (${JSON.stringify(vals)})`);
await mm.getByRole('button', { name: 'Cancel' }).click();

const t1 = await addUser('Ali Electric', 'Ali@KCML.iq', 'member:electrical');
check(/e-mail to set their password/.test(t1), `new person: account created + set-password e-mail (${t1})`);
await page.waitForTimeout(800);
check(await page.locator('.lrow', { hasText: 'ali@kcml.iq' }).first().waitFor({ timeout: 8000 }).then(() => true, () => false), 'new person listed with lower-case e-mail');
const oob = await (await fetch(`${AUTH}/emulator/v1/projects/${P}/oobCodes`)).json();
check(oob.oobCodes.some(c => c.email === 'ali@kcml.iq' && c.requestType === 'PASSWORD_RESET'), 'set-password e-mail was sent');

await page.waitForTimeout(3500);
const t2 = await addUser('Pre Existing', 'pre@kcml.iq', 'member:mechanical');
check(/Invitation saved/.test(t2), `existing login: invitation saved (${t2})`);
await page.waitForTimeout(800);
check(await page.isVisible('text=Pending invitations (1)'), 'pending invitation listed');
await page.waitForTimeout(3500);
const t3 = await addUser('Dup', 'pre@kcml.iq', 'manager');
check(/already exists/.test(t3), 'duplicate e-mail refused');
await page.locator('.modal').getByRole('button', { name: 'Cancel' }).click();

// The invited person signs in with their existing login and gets in with the invited role.
await page.locator('.side-user button').first().click();
await page.waitForSelector('.login-card form');
await inp.nth(0).fill('pre@kcml.iq'); await inp.nth(1).fill('PreExist123');
await page.click('.login-card form button.primary');
await page.waitForSelector('.sidebar .brand', { timeout: 20000 }).catch(() => {});
const roleText = await page.textContent('.side-user small').catch(() => '');
check(/Team Member/.test(roleText ?? ''), `invited person signed in with invited role (${roleText})`);
// Wait until the server has the new profile (the screen updates from the local copy first).
let onServer = false;
for (let k = 0; k < 20 && !onServer; k++) {
  const r = await (await fetch(`http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents/invites/pre@kcml.iq`, { headers: { Authorization: 'Bearer owner' } })).json();
  onServer = !!r.error; if (!onServer) await page.waitForTimeout(250);
}
check(onServer, 'invitation consumed on the server');

// Invitation consumed; admin sees them as a normal user.
await page.locator('.side-user button').first().click();
await page.waitForSelector('.login-card form');
await inp.nth(0).fill('admin@kcml.iq'); await inp.nth(1).fill('Admin12345');
await page.click('.login-card form button.primary');
await page.waitForSelector('.sidebar .brand');
await page.goto(new URL('/users', url).href);
await page.waitForTimeout(1500);
check(await page.locator('text=Pending invitations').waitFor({ state: 'hidden', timeout: 10000 }).then(() => true, () => false), 'invitation consumed');
check(await page.isVisible('text=pre@kcml.iq'), 'invited person now in the user list');
await page.screenshot({ path: process.env.OUT + '/users.png', fullPage: true });

await browser.close();
check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
console.log(ok ? 'ALL PASSED' : 'SOME CHECKS FAILED');
process.exit(ok ? 0 : 1);
