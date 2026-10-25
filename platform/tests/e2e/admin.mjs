// Administrator: rename shutdowns (current and past) and delete inspections. Run right after coldrun.mjs.
import { chromium } from 'playwright';

const url = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
const P = 'demo-coldrun';
const FS = `http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents`;
let ok = true;
const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
const errors = [];
const owner = { Authorization: 'Bearer owner' };
const decV = v => 'mapValue' in v ? dec(v.mapValue.fields) : 'arrayValue' in v ? (v.arrayValue.values ?? []).map(decV) : 'integerValue' in v ? Number(v.integerValue) : 'nullValue' in v ? null : Object.values(v)[0];
const dec = f => Object.fromEntries(Object.entries(f ?? {}).map(([k, v]) => [k, decV(v)]));
const list = async c => ((await (await fetch(`${FS}/${c}?pageSize=300`, { headers: owner })).json()).documents ?? []).map(d => ({ id: d.name.split('/').pop(), ...dec(d.fields) }));
const wait = async (fn, ms = 10000) => { const end = Date.now() + ms; for (;;) { const v = await fn(); if (v || Date.now() > end) return v; await new Promise(r => setTimeout(r, 300)); } };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('lang', 'en'); sessionStorage.setItem('installPromptDismissed', '1'); } catch { /* storage blocked */ } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/apis\.google\.com|ERR_TUNNEL/.test(m.text())) errors.push(m.text()); });
const go = async p => { await page.goto(new URL(p, url).href); await page.waitForSelector('.content h1', { timeout: 20000 }); await page.waitForTimeout(700); };
const signIn = async (email, pw) => {
  await page.goto(url); await page.waitForSelector('.login-card form');
  const i = page.locator('.login-card form input');
  await i.nth(0).fill(email); await i.nth(1).fill(pw); await page.click('.login-card form button.primary');
  await page.waitForSelector('.sidebar .brand', { timeout: 20000 }); await page.waitForTimeout(800);
};
const signOut = async () => { await page.locator('.side-user button').first().click(); await page.waitForSelector('.login-card form'); };

const before = await list('shutdowns');
const closed = before.find(s => s.status === 'closed');
const open = before.find(s => s.status === 'open');
const archived = (await list('inspections')).filter(i => i.shutdownId === closed.id);

// ---- managers and members get no admin controls ----
await signIn('maha@kcml.iq', 'Manager123!');
await go('/');
check(!(await page.isVisible('.shutdown-card button:has-text("Edit")')), 'manager: no Edit on the shutdown card');
await go(`/inspections/${archived[0].id}`);
check(!(await page.isVisible('button:has-text("Delete")')), 'manager: no Delete on an inspection');
await signOut();

// ---- administrator renames the past shutdown from Settings ----
await signIn('admin@kcml.iq', 'Admin12345');
await go('/settings');
const card = page.locator('.card', { hasText: 'Shutdowns & projects' });
check((await card.locator('.lrow').count()) === 2, 'Settings lists both shutdowns (current and past)');
await card.locator('.lrow').filter({ has: page.locator('b', { hasText: new RegExp(`^${closed.name.replace(/[()]/g, '\\$&')}$`) }) }).getByRole('button', { name: 'Edit' }).click();
const m = page.locator('.modal'); await m.waitFor();
await m.locator('input').nth(0).fill('Kiln overhaul 2026');
await m.locator('input[type=number]').fill('1990');
await m.getByRole('button', { name: 'Save' }).click();
check(/between 2000 and 2100/.test(await page.locator('.toast').last().textContent()), 'an impossible year is refused');
await m.locator('input[type=number]').fill('2026');
await m.getByRole('button', { name: 'Save' }).click();
await m.waitFor({ state: 'detached', timeout: 15000 }); // saved (the dialog closes when everything is written)
const renamed = await wait(async () => (await list('inspections')).filter(i => i.shutdownId === closed.id).every(i => i.shutdownName === 'Kiln overhaul 2026'));
const sdNow = (await list('shutdowns')).find(s => s.id === closed.id);
check(sdNow.name === 'Kiln overhaul 2026' && sdNow.year === 2026, 'past shutdown renamed');
check(renamed, `its ${archived.length} archived inspections show the new name`);
await go('/inspections?status=archived');
await page.locator('.filters select').first().selectOption(closed.id);
check((await page.locator('.filters select').first().locator('option:checked').textContent()) === 'Kiln overhaul 2026', 'Done tab filter shows the new name');

// ---- administrator renames the current shutdown from its card ----
await go('/');
await page.locator('.shutdown-card').getByRole('button', { name: 'Edit' }).click();
await page.locator('.modal input').nth(0).fill('Annual shutdown 2027 — main project');
await page.locator('.modal input[type=number]').fill('2027');
await page.locator('.modal').getByRole('button', { name: 'Save' }).click();
await page.locator('.modal').waitFor({ state: 'detached', timeout: 15000 });
check(/Annual shutdown 2027 — main project/.test(await page.textContent('.shutdown-card')), 'current shutdown renamed on the card');
check((await wait(async () => (await list('shutdowns')).find(s => s.id === open.id)?.year === 2027)), 'the administrator changes the year by hand');

// ---- administrator deletes an inspection ----
const victim = archived[0];
await go(`/inspections/${victim.id}`);
await page.getByRole('button', { name: 'Delete' }).click();
await page.locator('.modal').waitFor();
check(/cannot be undone/.test(await page.textContent('.modal')), 'delete asks for confirmation and warns it is permanent');
await page.locator('.modal .btn.danger').click();
await page.waitForURL(/\/inspections(\?|$)/, { timeout: 10000 });
const gone = await wait(async () => !(await list('inspections')).some(i => i.id === victim.id));
check(gone, 'inspection deleted');
const audited = await wait(async () => { const a = await list('audit'); return a.some(x => x.action === 'inspection.delete' && x.entityId === victim.id) && a.filter(x => x.action === 'shutdown.edit').length === 2; });
check(audited, 'deletion and both renames are in the audit log');
await go('/');
check((await page.locator('.kpi', { hasText: 'Done' }).locator('.kpi-val').textContent()) === String(archived.length - 1), 'Done count updated');

await browser.close();
check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 4).join(' | ') : ''));
console.log(ok ? 'ALL PASSED' : 'SOME CHECKS FAILED');
process.exit(ok ? 0 : 1);
