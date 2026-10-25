// End-to-end: the cold run workflow against the emulators (emulator build served at :4173).
import { chromium, devices } from 'playwright';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const url = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
const P = 'demo-coldrun';
const FS = `http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents`;
const OUT = process.env.OUT;
const LANG = process.env.LANG_UI ?? 'en';
let ok = true;
const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
const errors = [];
const owner = { Authorization: 'Bearer owner' };
const decV = v => 'mapValue' in v ? dec(v.mapValue.fields) : 'arrayValue' in v ? (v.arrayValue.values ?? []).map(decV) : 'integerValue' in v ? Number(v.integerValue) : 'nullValue' in v ? null : Object.values(v)[0];
const dec = f => Object.fromEntries(Object.entries(f ?? {}).map(([k, v]) => [k, decV(v)]));
const list = async c => ((await (await fetch(`${FS}/${c}?pageSize=300`, { headers: owner })).json()).documents ?? []).map(d => ({ id: d.name.split('/').pop(), ...dec(d.fields) }));
const getDoc = async p => { const r = await (await fetch(`${FS}/${p}`, { headers: owner })).json(); return r.fields ? dec(r.fields) : null; };
const wait = async (fn, ms = 10000) => { const end = Date.now() + ms; for (;;) { const v = await fn(); if (v || Date.now() > end) return v; await new Promise(r => setTimeout(r, 300)); } };

await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${P}/accounts`, { method: 'DELETE' });
await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${P}/databases/(default)/documents`, { method: 'DELETE' });

const browser = await chromium.launch();
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1300, height: 900 } });
await ctx.addInitScript(l => { try { localStorage.setItem('lang', l); sessionStorage.setItem('installPromptDismissed', '1'); } catch { /* storage blocked */ } }, LANG);
const page = await ctx.newPage();
page.on('pageerror', e => errors.push('pageerror ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/apis\.google\.com|ERR_TUNNEL|accounts:signUp/.test(m.text() + m.location().url)) errors.push(m.text()); });
const go = async p => { await page.goto(new URL(p, url).href); await page.waitForSelector('.content h1', { timeout: 20000 }); await page.waitForTimeout(600); };
const signIn = async (email, pw) => {
  await page.waitForSelector('.login-card form');
  const i = page.locator('.login-card form input');
  await i.nth(0).fill(email); await i.nth(1).fill(pw);
  await page.click('.login-card form button.primary');
  await page.waitForSelector('.sidebar .brand', { timeout: 20000 });
  await page.waitForTimeout(800);
};
const signOut = async () => { await page.locator('.side-user button').first().click(); await page.waitForSelector('.login-card form'); };
const toast = async () => { await page.waitForSelector('.toast', { timeout: 15000 }); return page.locator('.toast').last().textContent(); };
const confirmModal = async () => { await page.locator('.modal .btn.success, .modal .btn.primary, .modal .btn.danger').last().click(); };

// ---- 1. first-time setup: departments and the shutdown appear by themselves ----
await page.goto(url);
await page.waitForSelector('.login-card form');
const inp = page.locator('.login-card form input');
await inp.nth(0).fill('Admin'); await inp.nth(1).fill('admin@kcml.iq'); await inp.nth(2).fill('Admin12345');
await page.click('.login-card form button.primary');
await page.waitForSelector('.sidebar .brand', { timeout: 20000 });
const depts = await wait(async () => { const d = await list('departments'); return d.length === 10 && d; });
check(depts && depts.length === 10 && depts.some(d => d.name.en === 'Cement Mill 4'), 'the ten departments are created (Raw Mill 1–2, Kiln 1–2, Cooler 1–2, Cement Mill 1–4)');
const cfg = await wait(() => getDoc('config/shutdown'));
const sd1 = cfg && await getDoc(`shutdowns/${cfg.currentId}`);
check(sd1?.status === 'open' && /Annual shutdown \d{4}/.test(sd1.name), `the yearly shutdown starts automatically (${sd1?.name})`);
await page.waitForTimeout(2500);
check((await list('shutdowns')).length === 1, 'exactly one shutdown is created on first sign-in (no duplicates)');
await go('/');
check(await page.isVisible('.shutdown-card'), 'dashboard shows the shutdown card');
check(!(await page.isVisible('text=Load example')), 'no example/test data loader');

// ---- 2. equipment by CSV ----
await go('/equipment');
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download CSV|تنزيل CSV/ }).click()]);
const tmpl = `${OUT}/template.csv`; await dl.saveAs(tmpl);
const head = execFileSync('head', ['-c', '200', tmpl]).toString();
check(/Department,Equipment,Part type,Part/.test(head), 'CSV template downloads with the right columns');
const csv = '﻿Department;Equipment;Part type;Part\n'
  + 'Kiln 1;Kiln main drive;Electrical;Main motor\nKiln 1;Kiln main drive;Electrical;MCC panel\nKiln 1;Kiln main drive;Mechanical;Gearbox\n'
  + 'Kiln 1;Kiln main drive;Mechanical;"Girth gear; pinion"\nالفرن 1;Kiln ID fan;كهرباء;Fan motor\nRaw Mill 1;Raw mill separator;Electrical;Separator motor\n'
  + 'Moon base;Rocket;Electrical;Engine\nKiln 1;Kiln main drive;Welding;Torch\n';
writeFileSync(`${OUT}/upload.csv`, csv);
await page.locator('input[type=file][accept=".csv,text/csv"]').setInputFiles(`${OUT}/upload.csv`);
await page.waitForSelector('.modal');
const prev = await page.textContent('.modal');
check(/3 new/.test(prev) && /6 parts/.test(prev), 'upload preview: 3 new equipment, 6 parts (semicolon file, Arabic names, quoted values)');
check(/2 row\(s\) skipped/.test(prev), 'upload preview lists the 2 bad rows (unknown department, unknown part type)');
await page.screenshot({ path: `${OUT}/csv-preview.png` });
await page.locator('.modal').getByRole('button', { name: /^Import$|^استيراد$/ }).click();
await toast();
await page.waitForTimeout(800);
const eqs = await list('equipment');
const drive = eqs.find(e => e.name === 'Kiln main drive');
check(eqs.length === 3 && drive?.parts.electrical.length === 2 && drive.parts.mechanical.includes('Girth gear; pinion'), 'equipment imported with their parts');
// re-upload updates instead of duplicating
await page.locator('input[type=file][accept=".csv,text/csv"]').setInputFiles(`${OUT}/upload.csv`);
await page.waitForSelector('.modal');
check(/0 new and 3 updated/.test(await page.textContent('.modal')), 'uploading again updates, never duplicates');
await page.locator('.modal').getByRole('button', { name: /^Cancel$|^إلغاء$/ }).click();

// ---- 3. people ----
const addUser = async (name, email, role, disc, dept, pw) => {
  await go('/users');
  await page.locator('.page-head .btn.primary').click();
  const m = page.locator('.modal'); await m.waitFor();
  await m.locator('input').nth(0).fill(name);
  await m.locator('input[type=email]').fill(email);
  await m.locator('input[type=text].ltr').fill(pw);
  await m.locator('select').nth(0).selectOption(role);
  if (role === 'member') { await m.locator('select').nth(1).selectOption(disc); await m.locator('select').nth(2).selectOption(dept); }
  await m.locator('.btn.primary').click();
  await toast(); await page.waitForTimeout(1200);
};
await addUser('Maha Manager', 'maha@kcml.iq', 'manager', null, null, 'Manager123!');
await addUser('Ali Electric', 'ali@kcml.iq', 'member', 'electrical', 'KLN1', 'Member123!');
await addUser('Omar Mech', 'omar@kcml.iq', 'member', 'mechanical', 'KLN1', 'Member123!');
const users = await list('users');
const ali = users.find(u => u.email === 'ali@kcml.iq');
check(users.find(u => u.email === 'maha@kcml.iq')?.role === 'manager' && ali?.discipline === 'electrical' && ali?.departmentId === 'KLN1', 'manager and team members (discipline + department) added');
await page.screenshot({ path: `${OUT}/users.png` });

// ---- 4. electrical engineer (Kiln) ----
await signOut(); await signIn('ali@kcml.iq', 'Member123!');
await go('/tasks');
const startRows = await page.locator('.lrow:has(button.primary)').allTextContents();
check(startRows.length === 2 && startRows.every(r => /Kiln/.test(r) && /Electrical|كهرباء/.test(r)), `pool lists only Kiln equipment with electrical parts (${startRows.length})`);
await page.screenshot({ path: `${OUT}/pool.png` });
await go('/inspections/new');
check(await page.locator('select').first().isDisabled() && await page.locator('input[disabled]').first().inputValue() === 'Electrical', 'New Inspection: department and discipline fixed for a team member');
await page.locator('select').nth(1).selectOption({ label: 'Kiln main drive' });
check(await page.locator('input[disabled]').nth(1).inputValue() === 'Kiln main drive', 'title is the equipment name');
check((await page.locator('.part-preview li').allTextContents()).join('|') === 'Main motor|MCC panel', 'only the electrical parts are listed');
await page.getByRole('button', { name: /Create inspection|إنشاء الفحص/ }).click();
await page.waitForURL(/\/inspections\/SD-/);
await page.waitForSelector('.part-row');
const inspId = page.url().split('/').pop();
check(inspId.endsWith('_electrical'), 'inspection created, waiting in the pool');
check(/Waiting in pool|بانتظار الفريق/.test(await page.textContent('.page-head .badge')), 'status: Waiting in pool');
check(await page.locator('button:has-text("Submit inspection")').isDisabled(), 'submit is disabled until every part is checked');
await page.locator('.part-row').nth(0).locator('.qbtn.pass').click();
await page.waitForTimeout(900);
check((await getDoc(`inspections/${inspId}`)).results.p1.status === 'ok', 'part marked OK');
await page.locator('.part-row').nth(0).locator('.qbtn.pass').click();     // tap again → un-check
await page.waitForTimeout(900);
const un = await getDoc(`inspections/${inspId}`);
check(un.results.p1.status === 'pending' && un.summary.pending === 2, 'tapping OK again un-checks the part');
await page.locator('.part-row').nth(0).locator('.qbtn.pass').click();
await page.waitForTimeout(900);
await page.locator('.part-row').nth(1).locator('.qbtn.fail').click();
await page.locator('.part-row').nth(1).locator('textarea').fill('Cable gland loose');
await page.locator('.part-row').nth(1).getByRole('button', { name: /Save as Not OK/ }).click();
await page.waitForTimeout(900);
// un-check a Not OK part (asks first), then mark it Not OK again
await page.locator('.part-row').nth(1).locator('.qbtn.fail').click();
await page.locator('.modal .btn.primary').click();
await page.waitForTimeout(900);
check((await getDoc(`inspections/${inspId}`)).results.p2.status === 'pending', 'tapping Not OK again (and confirming) un-checks it');
await page.locator('.part-row').nth(1).locator('.qbtn.fail').click();
await page.locator('.part-row').nth(1).locator('textarea').fill('Cable gland loose');
await page.locator('.part-row').nth(1).getByRole('button', { name: /Save as Not OK/ }).click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/inspection-checked.png` });
await page.getByRole('button', { name: 'Submit inspection' }).click();
const woModal = page.locator('.modal', { hasText: 'Work order for corrective maintenance' });
check(await woModal.waitFor({ timeout: 5000 }).then(() => true, () => false), 'submit with a Not OK part asks for the work order');
check(await woModal.getByRole('button', { name: 'Submit to corrective maintenance' }).isDisabled(), 'the work order is required');
await woModal.locator('input').fill('  WO-2026-0153 ');
await woModal.getByRole('button', { name: 'Submit to corrective maintenance' }).click();
check(await page.locator('.toast', { hasText: /corrective maintenance needed/i }).first().waitFor({ timeout: 10000 }).then(() => true, () => false), 'submit with a Not OK part → corrective maintenance');
await page.waitForTimeout(800);
const afterWo = await getDoc(`inspections/${inspId}`);
check(afterWo.status === 'corrective' && afterWo.workOrder === 'WO-2026-0153', `status: Corrective maintenance, work order saved (${afterWo.workOrder})`);
check(/Work order: WO-2026-0153/.test(await page.textContent('.wo-line')), 'the work order is shown on the inspection');
await page.locator('.wo-line').getByRole('button', { name: 'Edit' }).click();
await page.locator('.modal input').fill('WO-2026-0154'); await page.locator('.modal').getByRole('button', { name: 'Save' }).click();
await page.waitForTimeout(1000);
check((await getDoc(`inspections/${inspId}`)).workOrder === 'WO-2026-0154', 'the team can correct the work order during corrective maintenance');
await page.locator('.part-row').nth(1).getByRole('button', { name: 'Mark fixed' }).click();
await page.locator('.part-row').nth(1).locator('textarea').fill('Gland tightened and sealed');
await page.locator('.part-row').nth(1).locator('.btn.primary').click();
await page.waitForTimeout(1200);
check((await getDoc(`inspections/${inspId}`)).status === 'waiting_approval', 'last fix → Waiting approval');
check(!(await page.isVisible('.action-bar button:has-text("Approve")')), 'a team member cannot approve');

// ---- 5. mechanical engineer: read-only on electrical, does their own ----
await signOut(); await signIn('omar@kcml.iq', 'Member123!');
await go(`/inspections/${inspId}`);
check(!(await page.locator('.qbtn').count()), 'mechanical engineer cannot change the electrical inspection');
await go('/tasks');
await page.locator('.lrow:has-text("Kiln main drive") button.primary').click();
await page.waitForURL(/_mechanical$/);
await page.waitForSelector('.part-row');
const mechId = page.url().split('/').pop();
for (let k = 0; k < 2; k++) { await page.locator('.part-row').nth(k).locator('.qbtn.pass').click(); await page.waitForTimeout(600); }
await page.getByRole('button', { name: 'Submit inspection' }).click();
check(await page.locator('.toast', { hasText: /Submitted — waiting approval/ }).first().waitFor({ timeout: 10000 }).then(() => true, () => false), 'all OK → Waiting approval');

// ---- 6. manager approves and closes the shutdown ----
await signOut(); await signIn('maha@kcml.iq', 'Manager123!');
await go('/tasks');
check((await page.locator('.lrow').count()) === 2, 'manager sees the 2 inspections waiting approval');
for (const id of [inspId, mechId]) {
  await go(`/inspections/${id}`);
  await page.locator('.action-bar').getByRole('button', { name: 'Approve' }).click();
  await page.locator('.modal textarea').fill('OK for cold run');
  await confirmModal();
  await toast(); await page.waitForTimeout(800);
}
check((await getDoc(`inspections/${inspId}`)).approval?.byName === 'Maha Manager', 'approved by the Cold Run Test Manager');
const notes = await list('notifications');
check(notes.some(n => n.toUid === users.find(u => u.role === 'admin').id && /approved/.test(n.title.en)), 'administrator notified of the approval');
await go(`/inspections/${inspId}`);
const [x1] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export Excel' }).click()]);
await x1.saveAs(`${OUT}/insp.xlsx`);
const xi = JSON.parse(execFileSync('python3', ['-I', new URL('./xlsx_check.py', import.meta.url).pathname, `${OUT}/insp.xlsx`]).toString());
check(xi.sheets.join() === 'Summary,Parts' && xi.cells.includes('Gland tightened and sealed') && xi.cells.includes('Maha Manager') && xi.cells.includes('WO-2026-0154'), 'inspection Excel: summary, parts, fix, work order and approval');

await go('/inspections?status=active');
check(/2/.test(await page.textContent('.tabs button.on')), 'Active inspections: 2');
await page.screenshot({ path: `${OUT}/active.png` });
await go('/');
const archiveBtn = page.getByRole('button', { name: /Close shutdown & archive/ });
check(await archiveBtn.isVisible(), 'archive button shows once every inspection is approved');
await archiveBtn.click();
await page.locator('.modal .btn.primary').click();
check(/moved to Done/.test(await toast()), 'shutdown closed and archived');
await page.waitForTimeout(1500);
const all = await list('inspections');
check(all.length === 2 && all.every(i => i.status === 'archived'), 'both inspections are in Done');
const cfg2 = await getDoc('config/shutdown');
check(cfg2.currentId !== cfg.currentId && (await getDoc(`shutdowns/${cfg.currentId}`)).status === 'closed', 'the next shutdown has started');
const sds = await list('shutdowns');
check(sds.length === 2 && sds.filter(x => x.status === 'open').length === 1, 'after archiving: one closed and exactly one open shutdown');
const nextSd = sds.find(x => x.status === 'open');
check(nextSd.year === sd1.year && nextSd.name === `${sd1.name} (2)`, `the next shutdown keeps the year — only the admin changes it (${nextSd.name}, ${nextSd.year})`);
await go('/');
const kpi = await page.locator('.kpi', { hasText: 'Active inspections' }).locator('.kpi-val').textContent();
check(kpi === '0', `active inspections back to 0 (${kpi})`);
check(/Done/.test(await page.textContent('.kpis')) && (await page.locator('.kpi', { hasText: 'Done' }).locator('.kpi-val').textContent()) === '2', 'Done shows 2');
await go('/inspections?status=archived');
check((await page.locator('.lrow').count()) === 2, 'Done tab lists the archived inspections');

// ---- 7. reports ----
await go('/reports');
await page.locator('.filters select').first().selectOption(cfg.currentId);
await page.waitForTimeout(400);
const [x2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export Excel' }).click()]);
await x2.saveAs(`${OUT}/rep.xlsx`);
const xr = JSON.parse(execFileSync('python3', ['-I', new URL('./xlsx_check.py', import.meta.url).pathname, `${OUT}/rep.xlsx`]).toString());
check(xr.cells.includes('Kiln 1') && xr.cells.some(c => /Shutdown: Annual shutdown/.test(c)), 'report Excel opens with the shutdown filter');
for (const r of ['By discipline', 'Not OK parts', 'Equipment not started', 'All inspections', 'Work per person']) {
  await page.locator('.chips .chip', { hasText: r }).click(); await page.waitForTimeout(300);
  check(await page.isVisible('.content h2'), `report "${r}" renders`);
}

// ---- 8. every page renders ----
for (const p of ['/', '/tasks', '/inspections', '/inspections/new', '/equipment', `/equipment/${drive.id}`, '/reports', '/documents', '/help', '/audit', '/settings']) {
  await go(p);
  check(!!(await page.textContent('.content h1')), `page ${p} renders`);
}
await signOut(); await signIn('admin@kcml.iq', 'Admin12345');
for (const p of ['/users', '/devices', '/settings']) { await go(p); check(!!(await page.textContent('.content h1')), `admin page ${p} renders`); }
check(await page.isVisible('table.priv') && (await page.locator('table.priv thead th').count()) === 4, 'roles table: Administrator, Cold Run Test Manager, Team Member');

// ---- 9. phone ----
const phone = await browser.newContext({ ...devices['Pixel 7'] });
await phone.addInitScript(() => { try { localStorage.setItem('lang', 'ar'); sessionStorage.setItem('installPromptDismissed', '1'); } catch { /* storage blocked */ } });
const pp = await phone.newPage();
pp.on('pageerror', e => errors.push('phone ' + e.message));
await pp.goto(url); await pp.waitForSelector('.login-card form');
const pi = pp.locator('.login-card form input');
await pi.nth(0).fill('ali@kcml.iq'); await pi.nth(1).fill('Member123!'); await pp.click('.login-card form button.primary');
await pp.waitForSelector('.bottombar', { timeout: 20000 });
await pp.goto(new URL(`/inspections/${inspId}`, url).href); await pp.waitForSelector('.part-row');
check(!(await pp.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'phone (Arabic): inspection page has no sideways scroll');
await pp.screenshot({ path: `${OUT}/phone-inspection.png`, fullPage: true });
await phone.close();

await browser.close();
check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''));
console.log(ok ? 'ALL PASSED' : 'SOME CHECKS FAILED');
process.exit(ok ? 0 : 1);
