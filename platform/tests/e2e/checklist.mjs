// Equipment codes: find equipment by code, name or checklist item; adjust the checklist when creating an
// inspection; devices pick up equipment added later (cached list, synced by config/catalog). Run after members.mjs.
import { chromium } from 'playwright';
const url = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
const FS = 'http://127.0.0.1:8080/v1/projects/demo-coldrun/databases/(default)/documents';
const owner = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
let ok = true;
const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
const errors = [];
const S = v => ({ stringValue: v }), A = l => ({ arrayValue: { values: l.map(S) } });
const now = () => ({ timestampValue: new Date().toISOString() });
const putEq = (id, code, name, parts) => fetch(`${FS}/equipment/${id}`, { method: 'PATCH', headers: owner, body: JSON.stringify({ fields: {
  code: S(code), name: S(name), departmentId: S('KLN1'), active: { booleanValue: true }, updatedAt: now(),
  parts: { mapValue: { fields: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, A(v)])) } } } }) });
const bump = async () => {
  const cur = await (await fetch(`${FS}/config/catalog`, { headers: owner })).json();
  const v = cur.fields ? Number(cur.fields.v.integerValue) + 1 : 1;
  await fetch(`${FS}/config/catalog`, { method: 'PATCH', headers: owner, body: JSON.stringify({ fields: { v: { integerValue: String(v) }, by: S('owner'), updatedAt: now() } }) });
};
const getDoc = async p => { const r = await (await fetch(`${FS}/${p}`, { headers: owner })).json(); return r; };

await putEq('K1M011', 'K1M011', 'ID Fan', {
  electrical: ['Motor insulation resistance (megger) measured and recorded', 'Direction of rotation verified (bump test)', 'MV/LV switchgear and protection relay tested'],
  mechanical: ['Impeller clean, no build-up; clearance to casing checked'], instrumentation: [], production: [] });
await bump();

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('lang', 'en'); sessionStorage.setItem('installPromptDismissed', '1'); } catch { /* storage blocked */ } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/apis\.google\.com|ERR_TUNNEL/.test(m.text())) errors.push(m.text()); });
await page.goto(url); await page.waitForSelector('.login-card form');
const i = page.locator('.login-card form input'); await i.nth(0).fill('maha@kcml.iq'); await i.nth(1).fill('Manager123!');
await page.click('.login-card form button.primary'); await page.waitForSelector('.sidebar .brand', { timeout: 20000 });
await page.goto(new URL('/inspections/new', url).href); await page.waitForSelector('.find-eq'); await page.waitForTimeout(1200);

// ---- search ----
await page.fill('.find-eq', 'k1m0');
check((await page.locator('.eq-hit').allTextContents()).some(x => /K1M011\s*ID Fan/.test(x)), 'search by part of the code finds K1M011 — ID Fan');
await page.fill('.find-eq', 'megger');
const viaItem = await page.locator('.eq-hit', { hasText: 'K1M011' }).textContent().catch(() => '');
check(/checklist item/.test(viaItem ?? ''), 'search by a checklist item finds the equipment and shows the matching item');
await page.fill('.find-eq', 'id fan');
await page.locator('.eq-hit', { hasText: 'K1M011' }).click();
check(await page.locator('.content select').nth(1).inputValue() === 'K1M011', 'picking a result selects the equipment');
check(await page.locator('input[disabled]').last().inputValue() === 'K1M011 — ID Fan', 'the title is "K1M011 — ID Fan"');
await page.locator('.content select').nth(2).selectOption('electrical');

// ---- adjust the checklist ----
const items = () => page.locator('.checklist-edit li').allTextContents();
check((await items()).length === 3, 'the standard electrical checklist is shown (3 items)');
await page.locator('.checklist-edit li', { hasText: 'Direction of rotation' }).getByRole('button').click();
await page.fill('.add-item', 'Fan guard fitted (site addition)'); await page.press('.add-item', 'Enter');
await page.fill('.add-item', 'fan guard fitted (SITE ADDITION)'); await page.getByRole('button', { name: 'Add', exact: true }).click();
check((await items()).length === 3 && await page.isVisible('.checklist-edit .badge.tone-orange'), 'an item removed, one added, a duplicate refused; marked "adjusted"');
await page.getByRole('button', { name: 'Back to the standard checklist' }).click();
check((await items()).length === 3 && (await items()).some(x => /Direction of rotation/.test(x)), 'back to the standard checklist');
await page.locator('.checklist-edit li', { hasText: 'Direction of rotation' }).getByRole('button').click();
await page.fill('.add-item', 'Fan guard fitted (site addition)'); await page.press('.add-item', 'Enter');
await page.getByRole('button', { name: 'Create inspection' }).click();
await page.waitForURL(/_K1M011_electrical$/, { timeout: 15000 });
const id = page.url().split('/').pop();
const d = (await getDoc(`inspections/${id}`)).fields;
const names = (d.parts.arrayValue.values ?? []).map(v => v.mapValue.fields.name.stringValue);
check(d.title.stringValue === 'K1M011 — ID Fan', `inspection title saved with the code (${d.title.stringValue})`);
check(names.length === 3 && names.includes('Fan guard fitted (site addition)') && !names.some(n => /Direction of rotation/.test(n)), 'the adjusted checklist is the inspection\'s parts');
check(await page.locator('.content h1', { hasText: 'K1M011 — ID Fan' }).waitFor({ timeout: 10000 }).then(() => true, () => false), 'the inspection page shows the code in its title');

// ---- equipment added while the app is open shows up (only the change is read) ----
await putEq('K1M012', 'K1M012', 'By-pass fan', { electrical: ['Motor insulation resistance (megger) measured and recorded'], mechanical: [], instrumentation: [], production: [] });
await bump();
await page.goto(new URL('/equipment', url).href); await page.waitForSelector('.content h1');
await page.fill('.content input[type=search]', 'K1M012');
const seen = await page.locator('.lrow', { hasText: 'K1M012' }).first().waitFor({ timeout: 10000 }).then(() => true, () => false);
check(seen, 'new equipment appears on an open device after the catalog changes');
await page.fill('.content input[type=search]', 'k1m011');
check(await page.locator('.lrow .eq-code', { hasText: 'K1M011' }).count() === 1 && await page.locator('.lrow .eq-code', { hasText: 'K1M012' }).count() === 0, 'equipment page search by code shows only that equipment');

await browser.close();
check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 4).join(' | ') : ''));
console.log(ok ? 'ALL PASSED' : 'SOME CHECKS FAILED');
process.exit(ok ? 0 : 1);
