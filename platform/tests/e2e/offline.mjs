// Field work without a network: the app opens offline, parts are checked (OK / Not OK with note), the
// inspection is submitted to corrective maintenance with its work order and a new inspection is started —
// all offline — and everything reaches the server when the connection returns. Run after coldrun.mjs.
import { chromium } from 'playwright';
const url = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
const FS = 'http://127.0.0.1:8080/v1/projects/demo-coldrun/databases/(default)/documents';
const owner = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
let ok = true;
const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
const errors = [];
const S = v => ({ stringValue: v });
const getDoc = async p => { const r = await (await fetch(`${FS}/${p}`, { headers: owner })).json(); return r.fields ? r : null; };
const wait = async (fn, ms = 20000) => { const end = Date.now() + ms; for (;;) { const v = await fn(); if (v || Date.now() > end) return v; await new Promise(r => setTimeout(r, 400)); } };

// two electrical equipment of Kiln 1 for Ali (electrical, KLN1)
const now = { timestampValue: new Date().toISOString() };
for (const [id, name] of [['K1M901', 'Offline test fan'], ['K1M902', 'Offline test pump']]) {
  await fetch(`${FS}/equipment/${id}`, { method: 'PATCH', headers: owner, body: JSON.stringify({ fields: {
    code: S(id), name: S(name), departmentId: S('KLN1'), active: { booleanValue: true }, updatedAt: now,
    parts: { mapValue: { fields: { electrical: { arrayValue: { values: [S('Motor insulation resistance'), S('Direction of rotation')] } } } } } } }) });
}
const cat = await getDoc('config/catalog');
await fetch(`${FS}/config/catalog`, { method: 'PATCH', headers: owner, body: JSON.stringify({ fields: { v: { integerValue: String((cat ? Number(cat.fields.v.integerValue) : 0) + 1) }, by: S('owner') } }) });
const sd = (await getDoc('config/shutdown')).fields.currentId.stringValue;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('lang', 'en'); sessionStorage.setItem('installPromptDismissed', '1'); } catch { /* storage blocked */ } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push(e.message));
await page.goto(url); await page.waitForSelector('.login-card form');
const i = page.locator('.login-card form input'); await i.nth(0).fill('ali@kcml.iq'); await i.nth(1).fill('Member123!');
await page.click('.login-card form button.primary'); await page.waitForSelector('.sidebar .brand', { timeout: 20000 });
// online once: start the first inspection and let the offline copy of the app install
await page.goto(new URL('/tasks', url).href); await page.waitForSelector('.content h1');
await page.locator('.lrow', { hasText: 'K1M901' }).getByRole('button', { name: 'Start' }).click();
await page.waitForURL(/_K1M901_electrical$/); await page.waitForSelector('.part-row');
const id1 = page.url().split('/').pop();
await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1500);

// ---- offline ----
await ctx.setOffline(true);
await page.reload(); await page.waitForSelector('.part-row', { timeout: 20000 }).catch(() => {});
check(await page.locator('.part-row').count() === 2, 'offline: the app reopens and shows the inspection');
check(await page.isVisible('.net.off'), 'offline: the app shows the offline sign');
await page.locator('.part-row').nth(0).locator('.qbtn.pass').click(); await page.waitForTimeout(500);
await page.locator('.part-row').nth(1).locator('.qbtn.fail').click();
await page.locator('.part-row').nth(1).locator('textarea').fill('Wrong rotation');
await page.locator('.part-row').nth(1).getByRole('button', { name: /Save as Not OK/ }).click(); await page.waitForTimeout(800);
check((await page.locator('.part-row').nth(0).locator('.qbtn.pass.on').count()) === 1 && (await page.locator('.part-row').nth(1).locator('.qbtn.fail.on').count()) === 1, 'offline: OK and Not OK (with note) saved on the device');
await page.getByRole('button', { name: 'Submit inspection' }).click();
await page.locator('.modal input').fill('WO-OFF-1'); await page.locator('.modal').getByRole('button', { name: 'Submit to corrective maintenance' }).click();
await page.waitForTimeout(1500);
check(await page.isVisible('.wo-line'), 'offline: submitted to corrective maintenance with its work order');
check((await getDoc(`inspections/${id1}`)).fields.status.stringValue === 'pool', 'while offline the server still has the old state (nothing sent yet)');
// start a second inspection offline
await page.goto(new URL('/tasks', url).href).catch(() => {}); await page.waitForSelector('.content h1', { timeout: 20000 }).catch(() => {});
await page.locator('.lrow', { hasText: 'K1M902' }).getByRole('button', { name: 'Start' }).click();
const started = await page.waitForURL(/_K1M902_electrical$/, { timeout: 15000 }).then(() => true, () => false);
check(started, 'offline: a new inspection can be started');
if (started) { await page.waitForSelector('.part-row'); await page.locator('.part-row').nth(0).locator('.qbtn.pass').click(); await page.waitForTimeout(500); }

// ---- back online ----
await ctx.setOffline(false);
const synced = await wait(async () => {
  const d = await getDoc(`inspections/${id1}`); const f = d?.fields;
  return f && f.status.stringValue === 'corrective' && f.workOrder?.stringValue === 'WO-OFF-1' && f.results.mapValue.fields.p2?.mapValue.fields.note.stringValue === 'Wrong rotation';
});
check(synced, 'online again: the checked parts, note, status and work order reach the server automatically');
const second = await wait(async () => { const d = await getDoc(`inspections/${sd}_K1M902_electrical`); return d && d.fields.results.mapValue.fields?.p1?.mapValue.fields.status.stringValue === 'ok'; });
check(second, 'online again: the inspection started offline (and its checked part) reaches the server');
const code = (await getDoc(`inspections/${sd}_K1M902_electrical`))?.fields.code.stringValue ?? '';
check(/^CR-\d{4}-/.test(code), `the offline inspection has a code (${code})`);

await browser.close();
check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 4).join(' | ') : ''));
console.log(ok ? 'ALL PASSED' : 'SOME CHECKS FAILED');
process.exit(ok ? 0 : 1);
