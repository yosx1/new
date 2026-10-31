// Sign-in edge cases: an account that is not registered, then a registered one on the same page (the
// "Your account is deactivated" bug), a really deactivated account, and a revoked device. Run after coldrun.mjs.
import { chromium } from 'playwright';
const url = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
const FS = 'http://127.0.0.1:8080/v1/projects/demo-coldrun/databases/(default)/documents';
const owner = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
let ok = true;
const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
const errors = [];
const list = async c => ((await (await fetch(`${FS}/${c}?pageSize=300`, { headers: owner })).json()).documents ?? []);

// an account that exists in Authentication but has no profile in the platform
await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'stranger@kcml.iq', password: 'Stranger123!', returnSecureToken: true }) });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('lang', 'en'); sessionStorage.setItem('installPromptDismissed', '1'); } catch { /* storage blocked */ } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push(e.message));
const signIn = async (email, pw) => {
  await page.waitForSelector('.login-card form');
  const i = page.locator('.login-card form input'); await i.nth(0).fill(email); await i.nth(1).fill(pw);
  await page.click('.login-card form button.primary');
};
const message = () => page.locator('.login-card .alert.warn').textContent({ timeout: 15000 }).catch(() => '');

await page.goto(url);
await signIn('stranger@kcml.iq', 'Stranger123!');
check(/not registered/.test(await message()), 'an account without a profile is told it is not registered (not "deactivated")');

// same page, no manual reload: the administrator signs in
await signIn('admin@kcml.iq', 'Admin12345');
const inAdmin = await page.waitForSelector('.sidebar .brand', { timeout: 20000 }).then(() => true, () => false);
check(inAdmin, 'a registered administrator then signs in on the same page');
check(!(await page.isVisible('text=deactivated')), 'no "deactivated" message for an active account');
await page.locator('.side-user button').first().click(); await page.waitForSelector('.login-card form');

// a member who is really deactivated while signed in
const omar = (await list('users')).find(u => u.fields.email.stringValue === 'omar@kcml.iq');
const omarId = omar.name.split('/').pop();
await signIn('omar@kcml.iq', 'Member123!'); await page.waitForSelector('.sidebar .brand', { timeout: 20000 });
await fetch(`${FS}/users/${omarId}?updateMask.fieldPaths=active`, { method: 'PATCH', headers: owner, body: JSON.stringify({ fields: { active: { booleanValue: false } } }) });
check(/deactivated/.test(await message()), 'a deactivated account is signed out with "deactivated"');
await fetch(`${FS}/users/${omarId}?updateMask.fieldPaths=active`, { method: 'PATCH', headers: owner, body: JSON.stringify({ fields: { active: { booleanValue: true } } }) });

// a revoked device
await signIn('omar@kcml.iq', 'Member123!'); await page.waitForSelector('.sidebar .brand', { timeout: 20000 }); await page.waitForTimeout(1500);
const dev = (await list('devices')).filter(d => d.name.includes(omarId)).sort((a, b) => (b.updateTime > a.updateTime ? 1 : -1))[0];
await fetch(`${dev.name.replace('projects/demo-coldrun/databases/(default)/documents', FS)}?updateMask.fieldPaths=revoked`, { method: 'PATCH', headers: owner, body: JSON.stringify({ fields: { revoked: { booleanValue: true } } }) });
check(/revoked|removed|device/i.test(await message()), 'a revoked device is signed out with its own message');
await fetch(`${dev.name.replace('projects/demo-coldrun/databases/(default)/documents', FS)}?updateMask.fieldPaths=revoked`, { method: 'PATCH', headers: owner, body: JSON.stringify({ fields: { revoked: { booleanValue: false } } }) });

// and the member can sign in again afterwards
await signIn('omar@kcml.iq', 'Member123!');
check(await page.waitForSelector('.sidebar .brand', { timeout: 20000 }).then(() => true, () => false), 'after re-activation the member signs in normally');

// an administrator deletes a person: gone from the list, and they cannot get in any more
const r = await (await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'leaver@kcml.iq', password: 'Leaver123!', returnSecureToken: true }) })).json();
const P = (f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === null ? { nullValue: null } : typeof v === 'boolean' ? { booleanValue: v } : { stringValue: v }]));
await fetch(`${FS}/users/${r.localId}`, { method: 'PATCH', headers: owner, body: JSON.stringify({ fields: P({ name: 'Leaving Person', email: 'leaver@kcml.iq', role: 'member', discipline: 'electrical', departmentId: 'KLN1', phone: '', active: true, lang: 'en' }) }) });
await page.locator('.side-user button').first().click(); await page.waitForSelector('.login-card form');
await signIn('admin@kcml.iq', 'Admin12345'); await page.waitForSelector('.sidebar .brand', { timeout: 20000 });
await page.goto(new URL('/users', url).href); await page.waitForSelector('.content h1'); await page.waitForTimeout(1000);
check(await page.isVisible('text=Leaving Person'), 'the person is in the user list');
check(!(await page.locator('.lrow', { hasText: 'Admin' }).first().locator('button[aria-label^="Delete"]').count()), 'an administrator has no Delete button on their own account');
await page.getByRole('button', { name: 'Delete: Leaving Person' }).click();
await page.locator('.modal .btn.danger').click();
const gone = await page.locator('text=Leaving Person').waitFor({ state: 'detached', timeout: 10000 }).then(() => true, () => false);
check(gone, 'after Delete the person is no longer listed');
const waitFor = async (fn, ms = 10000) => { const end = Date.now() + ms; for (;;) { if (await fn()) return true; if (Date.now() > end) return false; await new Promise(x => setTimeout(x, 400)); } };
check(await waitFor(async () => !(await list('users')).some(u => u.name.endsWith(r.localId))), 'their profile is removed on the server');
check(await waitFor(async () => (await list('audit')).some(a => a.fields.action.stringValue === 'user.delete')), 'the deletion is in the audit log');
await page.locator('.side-user button').first().click(); await page.waitForSelector('.login-card form');
await signIn('leaver@kcml.iq', 'Leaver123!');
check(/not registered/.test(await message()), 'the deleted person cannot get in (not registered)');

await browser.close();
check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 4).join(' | ') : ''));
console.log(ok ? 'ALL PASSED' : 'SOME CHECKS FAILED');
process.exit(ok ? 0 : 1);
