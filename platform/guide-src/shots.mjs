// Guide screenshots (English + Arabic). Run right after coldrun.mjs (uses its users and equipment).
import { chromium, devices } from 'playwright';

const url = 'http://127.0.0.1:4173/';
const P = 'demo-coldrun';
const FS = `http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents`;
const OUT = process.env.OUT;
const CSV = process.env.CSV;
const owner = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const enc = v => v === null || v === undefined ? { nullValue: null }
  : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : v instanceof Date ? { timestampValue: v.toISOString() } : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } }
  : typeof v === 'object' ? { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } } : { stringValue: String(v) };
const decV = v => 'mapValue' in v ? dec(v.mapValue.fields) : 'arrayValue' in v ? (v.arrayValue.values ?? []).map(decV) : 'integerValue' in v ? Number(v.integerValue) : 'nullValue' in v ? null : Object.values(v)[0];
const dec = f => Object.fromEntries(Object.entries(f ?? {}).map(([k, v]) => [k, decV(v)]));
const put = (path, obj) => fetch(`${FS}/${path}`, { method: 'PATCH', headers: owner, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, enc(v)])) }) }).then(r => r.json());
const list = async c => ((await (await fetch(`${FS}/${c}?pageSize=300`, { headers: owner })).json()).documents ?? []).map(d => ({ id: d.name.split('/').pop(), ...dec(d.fields) }));
const getDoc = async p => { const r = await (await fetch(`${FS}/${p}`, { headers: owner })).json(); return r.fields ? dec(r.fields) : null; };

// ---- data: a current shutdown with inspections in every stage ----
const sdId = (await getDoc('config/shutdown')).currentId;
const sd = await getDoc(`shutdowns/${sdId}`);
const users = await list('users');
const U = e => users.find(u => u.email === e);
const ali = U('ali@kcml.iq'), omar = U('omar@kcml.iq'), maha = U('maha@kcml.iq');
const eqs = await list('equipment');
const E = n => eqs.find(e => e.name === n);
const now = new Date();
let n = 20;
const mk = async (e, d, status, results, by, extra = {}) => {
  const parts = e.parts[d].map((name, k) => ({ id: `p${k + 1}`, name }));
  const res = Object.fromEntries(Object.entries(results).map(([pid, r]) => [pid, { note: '', photoIds: [], by: by.id, byName: by.name, at: now, fix: null, ...r }]));
  const vals = Object.values(res);
  const summary = { total: parts.length, ok: vals.filter(r => r.status === 'ok').length, notok: vals.filter(r => r.status === 'notok').length,
    fixed: vals.filter(r => r.status === 'notok' && r.fix).length, pending: parts.length - vals.length };
  const id = `${sdId}_${e.id}_${d}`;
  await put(`inspections/${id}`, { code: `CR-${sd.year}-00${n++}`, shutdownId: sdId, shutdownName: sd.name, title: e.name, equipmentId: e.id, departmentId: e.departmentId,
    discipline: d, parts, results: res, summary, status, createdBy: by.id, createdByName: by.name, createdAt: now, updatedAt: now, approval: null, rejection: null, docVersion: 2, ...extra });
  return id;
};
const drive = E('Kiln main drive'), sep = E('Raw mill separator');
const checked = await mk(drive, 'electrical', 'pool', { p1: { status: 'ok' }, p2: { status: 'notok', note: 'Cable gland loose at the MCC panel entry' } }, ali);
const corrective = await mk(drive, 'mechanical', 'corrective', { p1: { status: 'ok' }, p2: { status: 'notok', note: 'Oil leak at the pinion seal' } }, omar, { workOrder: 'WO-2026-0153' });
const waiting = await mk(sep, 'electrical', 'waiting_approval', { p1: { status: 'ok' } }, ali);

// example usage of the day, so the Plan & billing card shows its bars
const usageDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
await put(`usage/${usageDay}`, { reads: 13450, writes: 2150, deletes: 40, updatedAt: now });

const browser = await chromium.launch();
const ctxs = {};
async function pageFor(lang, who) {
  const key = lang + who;
  if (ctxs[key]) return ctxs[key];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 });
  await ctx.addInitScript(l => { try { localStorage.setItem('lang', l); sessionStorage.setItem('installPromptDismissed', '1'); localStorage.removeItem('hiddenTips'); } catch { /* storage blocked */ } }, lang);
  const page = await ctx.newPage();
  await page.goto(url); await page.waitForSelector('.login-card form');
  const i = page.locator('.login-card form input');
  const pw = who === 'admin@kcml.iq' ? 'Admin12345' : who === 'maha@kcml.iq' ? 'Manager123!' : 'Member123!';
  await i.nth(0).fill(who); await i.nth(1).fill(pw); await page.click('.login-card form button.primary');
  await page.waitForSelector('.sidebar .brand', { timeout: 20000 });
  await page.waitForTimeout(1200);
  return (ctxs[key] = page);
}
const shot = async (page, name, lang) => { await page.waitForTimeout(900); await page.screenshot({ path: `${OUT}/${lang}-${name}.png` }); };
const go = async (page, p) => { await page.goto(new URL(p, url).href); await page.waitForSelector('.content h1', { timeout: 20000 }); await page.waitForTimeout(700); };

for (const lang of ['en', 'ar']) {
  // signed out
  const c0 = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 });
  await c0.addInitScript(l => { try { localStorage.setItem('lang', l); sessionStorage.setItem('installPromptDismissed', '1'); } catch { /* storage blocked */ } }, lang);
  const p0 = await c0.newPage(); await p0.goto(url); await p0.waitForSelector('.login-card form'); await shot(p0, 'login', lang); await c0.close();
  const ph = await browser.newContext({ ...devices['iPhone 13'] });
  await ph.addInitScript(l => { try { localStorage.setItem('lang', l); } catch { /* storage blocked */ } }, lang);
  const pp = await ph.newPage(); await pp.goto(url); await pp.waitForSelector('.install-prompt', { timeout: 8000 }).catch(() => {});
  await pp.waitForTimeout(800); await pp.screenshot({ path: `${OUT}/${lang}-phone-install.png` }); await ph.close();

  const a = await pageFor(lang, 'ali@kcml.iq');
  await go(a, '/'); await shot(a, 'member', lang);
  await go(a, '/tasks'); await shot(a, 'pool', lang);
  await go(a, '/inspections/new'); await a.locator('select').nth(1).selectOption({ index: 2 }); await shot(a, 'new', lang);
  await go(a, `/inspections/${checked}`); await a.waitForSelector('.part-row'); await shot(a, 'checked', lang);
  for (const r of await a.locator('.part-row').all()) if (!(await r.locator('.qbtn.on').count())) { await r.locator('.qbtn.pass').click(); await a.waitForTimeout(500); }
  await a.locator('.action-bar .btn.primary').click(); await a.locator('.modal input').fill('WO-2026-0153'); await shot(a, 'workorder', lang);
  await a.locator('.modal').getByRole('button', { name: /Cancel|إلغاء/ }).click();

  const o = await pageFor(lang, 'omar@kcml.iq');
  await go(o, `/inspections/${corrective}`); await o.waitForSelector('.part-row');
  await o.locator('.part-row').nth(1).locator('.btn.outline').click(); await o.locator('.part-row').nth(1).locator('textarea').fill(lang === 'ar' ? 'تم تبديل مانع التسرب' : 'Seal replaced, no leak after test run');
  await shot(o, 'corrective', lang);

  const m = await pageFor(lang, 'maha@kcml.iq');
  await go(m, '/'); await shot(m, 'dashboard', lang);
  await go(m, `/inspections/${waiting}`); await m.locator('.action-bar .btn.success').click(); await m.waitForSelector('.modal');
  await m.locator('.modal textarea').fill(lang === 'ar' ? 'جاهز للتشغيل البارد' : 'Ready for the cold run'); await shot(m, 'approve', lang);
  await m.keyboard.press('Escape');
  await go(m, '/reports'); await shot(m, 'reports', lang);

  const ad = await pageFor(lang, 'admin@kcml.iq');
  await go(ad, '/equipment'); await shot(ad, 'equipment', lang);
  await ad.locator('input[type=file][accept=".csv,text/csv"]').setInputFiles(CSV); await ad.waitForSelector('.modal'); await shot(ad, 'csv', lang);
  await ad.keyboard.press('Escape');
  await go(ad, '/users'); await ad.locator('.page-head .btn.primary').click(); const um = ad.locator('.modal'); await um.waitFor();
  await um.locator('input').nth(0).fill(lang === 'ar' ? 'حسين مهندس سيطرة' : 'Hussein Instrumentation'); await um.locator('input[type=email]').fill('hussein@kcml.iq');
  await um.locator('select').nth(0).selectOption('member'); await um.locator('select').nth(1).selectOption('instrumentation'); await um.locator('select').nth(2).selectOption('CLR1');
  await shot(ad, 'user-add', lang); await ad.keyboard.press('Escape');
  await go(ad, '/settings'); await ad.locator('table.priv').evaluate(e => e.closest('.card').scrollIntoView({ block: 'start' })); await shot(ad, 'roles', lang);
  await ad.locator('.card', { hasText: /Completion reports|تقارير الإنجاز/ }).last().evaluate(e => e.scrollIntoView({ block: 'start' })); await shot(ad, 'report-settings', lang);
  await ad.locator('.card', { hasText: /Plan & billing|الخطة والدفع/ }).last().evaluate(e => e.scrollIntoView({ block: 'start' })); await shot(ad, 'billing', lang);
  await go(ad, '/help'); await ad.locator('.guide-head').nth(1).click(); await shot(ad, 'guide', lang);
}

// ---- everything approved → archive button; then archive → Done ----
for (const i of await list('inspections')) {
  if (i.shutdownId !== sdId) continue;
  const { id, ...doc } = i;
  for (const r of Object.values(doc.results ?? {})) if (r.status === 'notok' && !r.fix) r.fix = { note: 'Repaired and re-tested', photoIds: [], by: omar.id, byName: omar.name, at: now };
  doc.summary = { ...doc.summary, fixed: doc.summary.notok, pending: 0 };
  await put(`inspections/${id}`, { ...doc, status: 'approved', approval: { by: maha.id, byName: maha.name, at: now, comment: '' } });
}
for (const lang of ['en', 'ar']) { const m = await pageFor(lang, 'maha@kcml.iq'); await go(m, '/inspections?status=approved'); await shot(m, 'archive', lang); }
const m = await pageFor('en', 'maha@kcml.iq');
await m.getByRole('button', { name: /Close shutdown & archive/ }).click(); await m.locator('.modal .btn.primary').click();
await m.waitForSelector('.toast'); await m.waitForTimeout(1500);
for (const lang of ['en', 'ar']) { const p = await pageFor(lang, 'maha@kcml.iq'); await go(p, '/inspections?status=archived'); await shot(p, 'done', lang); }
await browser.close();
console.log('done');
