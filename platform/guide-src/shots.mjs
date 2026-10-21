// Screenshots for the user guide, in English and Arabic. Run after full.mjs (needs its data).
import { chromium, devices } from 'playwright';

const url = 'http://127.0.0.1:4173/';
const P = 'demo-coldrun';
const FS = `http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents`;
const OUT = process.env.OUT;
const owner = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const enc = v => v === null || v === undefined ? { nullValue: null }
  : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : v instanceof Date ? { timestampValue: v.toISOString() } : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } }
  : typeof v === 'object' ? { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } } : { stringValue: String(v) };
const decV = v => 'mapValue' in v ? dec(v.mapValue.fields) : 'arrayValue' in v ? (v.arrayValue.values ?? []).map(decV) : 'integerValue' in v ? Number(v.integerValue) : 'nullValue' in v ? null : Object.values(v)[0];
const dec = f => Object.fromEntries(Object.entries(f ?? {}).map(([k, v]) => [k, decV(v)]));
const put = (path, obj) => fetch(`${FS}/${path}`, { method: 'PATCH', headers: owner, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, enc(v)])) }) }).then(r => r.json());
const list = async c => ((await (await fetch(`${FS}/${c}?pageSize=300`, { headers: owner })).json()).documents ?? []).map(d => ({ id: d.name.split('/').pop(), ...dec(d.fields) }));

// ---- an inspection in progress with a failed item and an open defect ----
const users = await list('users');
const admin = users.find(u => u.email === 'admin@kcp.iq');
const tpls = await list('templates');
let tpl, ver;
for (const t of tpls) { const v = await list(`templates/${t.id}/versions`); const best = v.find(x => x.sections?.length >= 2); if (best) { tpl = t; ver = best; break; } }
const eq = (await list('equipment')).find(e => (tpl.equipmentCategories ?? []).includes(e.category)) ?? (await list('equipment'))[0];
const now = new Date();
const checklist = ver.sections;
const s1 = checklist[0], s2 = checklist[1];
await put('inspections/DEMO1', {
  code: 'CR-2026-0012', title: `${eq.tag} restart after overhaul`, plantName: 'Karbala Cement Plant', departmentId: eq.departmentId, equipmentId: eq.id, equipmentTag: eq.tag,
  equipmentName: eq.name, equipmentCategory: eq.category ?? '', workOrder: 'WO-24817', maintenanceType: 'Overhaul', maintenanceCompletedAt: '2026-10-19',
  inspectionDate: '2026-10-21', shift: 'A (07:00–15:00)', supervisorUid: admin.id, assignedUids: [], templateId: tpl.id, templateCode: tpl.code,
  templateName: tpl.name, templateVersion: tpl.currentVersion ?? 1, checklist, requiredApprovals: tpl.requiredApprovals ?? ['mechanical'],
  approvals: {}, override: null, status: 'in_progress',
  summary: { total: 1, pass: 0, fail: 0, pending: 1, na: 0, mandatoryPending: 1, criticalFail: 0, openDefects: 0, openCritical: 0, awaitingVerification: 0, sections: {} },
  pools: [], createdAt: now, createdBy: admin.id, createdByName: 'Admin', updatedAt: now, docVersion: 1,
});
const r = (sec, item, status, extra = {}) => put(`inspections/DEMO1/results/${item.id}`, { id: item.id, sectionId: sec.id, discipline: sec.discipline, status,
  inspectorUid: admin.id, inspectorName: 'Admin', at: now, rev: 1, ...extra });
for (const it of s1.items.slice(0, Math.max(1, s1.items.length - 1))) await r(s1, it, 'pass');
const failItem = s2.items[0];
await put('defects/DEMOD1', {
  code: 'DF-2026-0007', inspectionId: 'DEMO1', inspectionCode: 'CR-2026-0012', departmentId: eq.departmentId, equipmentId: eq.id, equipmentTag: eq.tag,
  itemId: failItem.id, itemLabel: failItem.label, description: 'Found loose and needs tightening before restart.', severity: 'high', pool: s2.discipline,
  assignedUid: null, assignedName: null, reportedAt: now, reportedBy: admin.id, reportedByName: 'Admin', targetDate: '2026-10-24', status: 'open',
  repair: null, verification: null, updatedAt: now,
});
await r(s2, failItem, 'fail', { comment: 'Found loose and needs tightening before restart.', defectId: 'DEMOD1' });

const browser = await chromium.launch();
async function run(lang) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5, acceptDownloads: true });
  await ctx.addInitScript(l => { try { localStorage.setItem('lang', l); sessionStorage.setItem('installPromptDismissed', '1'); localStorage.removeItem('hiddenTips'); } catch {} }, lang);
  const page = await ctx.newPage();
  const shot = async (name, opts = {}) => { await page.waitForTimeout(900); await page.screenshot({ path: `${OUT}/${lang}-${name}.png`, ...opts }); };
  const go = async p => { await page.goto(new URL(p, url).href); await page.waitForSelector('.content h1, .login-card', { timeout: 20000 }); };

  await go('/'); await page.waitForSelector('.login-card form'); await shot('login');
  const i = page.locator('.login-card form input');
  await i.nth(0).fill('admin@kcp.iq'); await i.nth(1).fill('Admin12345'); await page.click('.login-card form button.primary');
  await page.waitForSelector('.sidebar .brand');
  await go('/'); await shot('dashboard');
  await go('/tasks'); await shot('tasks');
  await go('/inspections/new'); await page.locator('select').first().selectOption({ index: 1 }).catch(() => {}); await shot('new');
  await go('/inspections/DEMO1'); await page.locator('.sec-head').first().click().catch(() => {}); await shot('execute');
  await page.locator('.item-main:visible').first().click(); await page.waitForSelector('.modal, .sheet, [role=dialog]'); await shot('item');
  await page.keyboard.press('Escape');
  await go('/inspections/DEMO1?tab=review'); await shot('review');
  await go('/defects'); await shot('defects');
  await go('/defects/DEMOD1'); await shot('defect');
  await go('/reports'); await shot('reports');
  await go('/users'); await shot('users');
  await page.locator('.page-head .btn.primary').click(); await page.waitForSelector('.modal'); await shot('user-add');
  await page.keyboard.press('Escape');
  await go('/devices'); await shot('devices');
  await go('/templates'); await shot('templates');
  await go('/equipment'); await shot('equipment');
  await go('/settings');
  await page.locator('table.priv').scrollIntoViewIfNeeded(); await page.locator('table.priv').evaluate(e => e.closest('.card').scrollIntoView({ block: 'start' }));
  await shot('roles');
  await page.locator('.recipients, .card:last-of-type').last().evaluate(e => e.closest('.card').scrollIntoView({ block: 'start' }));
  await shot('report-settings');
  await go('/audit'); await shot('audit');
  await go('/help'); await page.locator('.guide-head').nth(1).click(); await shot('guide');
  await ctx.close();

  const ph = await browser.newContext({ ...devices['iPhone 13'] });
  await ph.addInitScript(l => { try { localStorage.setItem('lang', l); } catch {} }, lang);
  const pp = await ph.newPage();
  await pp.goto(url); await pp.waitForSelector('.install-prompt', { timeout: 8000 }).catch(() => {});
  await pp.waitForTimeout(800); await pp.screenshot({ path: `${OUT}/${lang}-phone-install.png` });
  await ph.close();
}
await run('en');
await run('ar');
await browser.close();
console.log('done');
