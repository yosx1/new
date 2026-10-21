// Role behaviour: each team member sees and works only their own discipline + department; no admin areas.
// Run right after coldrun.mjs (uses its accounts: admin, maha manager, ali electrical KLN1, omar mechanical KLN1).
import { chromium } from 'playwright';
const url = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
const P = 'demo-coldrun';
const FS = `http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents`;
const owner = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
let ok = true;
const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
const errors = [];
const decV = v => 'mapValue' in v ? dec(v.mapValue.fields) : 'arrayValue' in v ? (v.arrayValue.values ?? []).map(decV) : 'integerValue' in v ? Number(v.integerValue) : 'nullValue' in v ? null : Object.values(v)[0];
const dec = f => Object.fromEntries(Object.entries(f ?? {}).map(([k, v]) => [k, decV(v)]));
const list = async c => ((await (await fetch(`${FS}/${c}?pageSize=300`, { headers: owner })).json()).documents ?? []).map(d => ({ id: d.name.split('/').pop(), raw: d.fields, ...dec(d.fields) }));

// ---- extra people: electrical in Raw Mill 1, electrical without a department ----
async function person(email, name, discipline, departmentId) {
  const r = await (await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Member123!', returnSecureToken: true }) })).json();
  const f = { name: { stringValue: name }, email: { stringValue: email }, role: { stringValue: 'member' }, discipline: { stringValue: discipline },
    departmentId: departmentId ? { stringValue: departmentId } : { nullValue: null }, phone: { stringValue: '' }, active: { booleanValue: true }, lang: { stringValue: 'en' } };
  await fetch(`${FS}/users/${r.localId}`, { method: 'PATCH', headers: owner, body: JSON.stringify({ fields: f }) });
}
await person('zaid@kcp.iq', 'Zaid RM Electric', 'electrical', 'RML1');
await person('noor@kcp.iq', 'Noor All Electric', 'electrical', null);

// ---- current-shutdown inspections for three teams (cloned from an archived one) ----
const cur = (await (await fetch(`${FS}/config/shutdown`, { headers: owner })).json()).fields.currentId.stringValue;
const archived = (await list('inspections')).filter(i => i.status === 'archived');
const base = archived[0].raw;
const teams = [['electrical', 'KLN1', 'Kiln test A'], ['mechanical', 'KLN1', 'Kiln test B'], ['electrical', 'RML1', 'Raw mill test C']];
for (const [d, dep, title] of teams) {
  const id = `${cur}_T${dep}${d}_${d}`;
  const f = { ...base, shutdownId: { stringValue: cur }, status: { stringValue: 'pool' }, discipline: { stringValue: d }, departmentId: { stringValue: dep },
    title: { stringValue: title }, equipmentId: { stringValue: 'T' + dep + d }, results: { mapValue: { fields: {} } }, approval: { nullValue: null }, docVersion: { integerValue: '1' },
    summary: { mapValue: { fields: { total: { integerValue: '2' }, ok: { integerValue: '0' }, notok: { integerValue: '0' }, fixed: { integerValue: '0' }, pending: { integerValue: '2' } } } } };
  await fetch(`${FS}/inspections/${id}`, { method: 'PATCH', headers: owner, body: JSON.stringify({ fields: f }) });
}
const doneBy = (d, dep) => archived.filter(i => i.discipline === d && (!dep || i.departmentId === dep)).length;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('lang', 'en'); sessionStorage.setItem('installPromptDismissed', '1'); } catch { /* storage blocked */ } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/apis\.google\.com|ERR_TUNNEL/.test(m.text())) errors.push(m.text()); });
const go = async p => { await page.goto(new URL(p, url).href); await page.waitForSelector('.content h1', { timeout: 20000 }); await page.waitForTimeout(900); };
const signIn = async email => {
  await page.goto(url); await page.waitForSelector('.login-card form');
  const i = page.locator('.login-card form input');
  await i.nth(0).fill(email); await i.nth(1).fill(email.startsWith('admin') ? 'Admin12345' : email.startsWith('maha') ? 'Manager123!' : 'Member123!');
  await page.click('.login-card form button.primary');
  await page.waitForSelector('.sidebar .brand', { timeout: 20000 }); await page.waitForTimeout(1500);
};
const signOut = async () => { await page.locator('.side-user button').first().click(); await page.waitForSelector('.login-card form'); };
const nav = async () => (await page.locator('.sidebar .nav-link').allTextContents()).map(s => s.replace(/\d+$/, '').trim());
const titles = async () => (await page.locator('.content .lrow b, .content .lrow .title').allTextContents()).join(' | ');
const redirected = async p => { await page.goto(new URL(p, url).href); await page.waitForTimeout(1500); return new URL(page.url()).pathname === '/'; };

const MEMBERS = [
  ['ali@kcp.iq', 'electrical KLN1', ['Kiln test A'], ['Kiln test B', 'Raw mill test C'], doneBy('electrical', 'KLN1')],
  ['omar@kcp.iq', 'mechanical KLN1', ['Kiln test B'], ['Kiln test A', 'Raw mill test C'], doneBy('mechanical', 'KLN1')],
  ['zaid@kcp.iq', 'electrical RML1', ['Raw mill test C'], ['Kiln test A', 'Kiln test B'], doneBy('electrical', 'RML1')],
  ['noor@kcp.iq', 'electrical, all departments', ['Kiln test A', 'Raw mill test C'], ['Kiln test B'], doneBy('electrical')],
];
for (const [email, who, mine, others, done] of MEMBERS) {
  await signIn(email);
  const n = await nav();
  check(!n.some(x => /Reports|Users|Devices|Audit|Settings/.test(x)) && n.includes('My profile'), `${who}: menu has no Reports/Users/Devices/Audit/Settings, has My profile (${n.join(', ')})`);
  await go('/tasks'); const tk = await titles();
  check(mine.every(x => tk.includes(x)) && !others.some(x => tk.includes(x)), `${who}: Tasks shows only own team (${mine.join(', ')})`);
  await go('/inspections?status=pool'); const pool = await titles();
  check(mine.every(x => pool.includes(x)) && !others.some(x => pool.includes(x)), `${who}: Inspections lists only own team`);
  await go('/inspections?status=archived'); await page.waitForTimeout(800);
  const doneTab = Number((await page.locator('.tabs button', { hasText: 'Done' }).locator('.tab-n').textContent()).trim());
  check(doneTab === done, `${who}: Done shows only own team's history (${doneTab}/${done})`);
  await go('/');
  check(!(await page.isVisible('.shutdown-card button:has-text("Edit")')) && !(await page.isVisible('button:has-text("Close shutdown")')), `${who}: no shutdown Edit / archive`);
  await go('/settings');
  const cards = (await page.locator('.content .card h2, .content .card .card-title, .content .card h3').allTextContents()).join(' | ');
  check(!/Departments|Shutdowns|Privileges|Roles|Reports & e-mail|Plan & billing|System/.test(cards), `${who}: profile page has no admin sections (${cards.slice(0, 80)})`);
  check(await redirected('/users') && await redirected('/devices') && await redirected('/reports') && await redirected('/audit'), `${who}: /users /devices /reports /audit send back to the dashboard`);
  await go('/equipment');
  check(!(await page.isVisible('button:has-text("Upload CSV")')) && !(await page.isVisible('button:has-text("Add equipment")')), `${who}: equipment is read-only`);
  // another team's inspection opened by link: read-only
  const other = (await list('inspections')).find(i => i.title === others[0] && i.status === 'pool');
  await go(`/inspections/${other.id}`);
  check((await page.locator('.qbtn').count()) === 0 && !(await page.isVisible('button:has-text("Approve")')) && !(await page.isVisible('button:has-text("Delete")')), `${who}: another team's inspection opened by link is read-only`);
  const own = (await list('inspections')).find(i => i.title === mine[0] && i.status === 'pool');
  await go(`/inspections/${own.id}`);
  check((await page.locator('.qbtn').count()) > 0 && !(await page.isVisible('button:has-text("Approve")')) && !(await page.isVisible('button:has-text("Delete")')), `${who}: own team's inspection can be checked, not approved or deleted`);
  await signOut();
}

// ---- the manager: everything of the cold run, no administration ----
await signIn('maha@kcp.iq');
const mn = await nav();
check(mn.some(x => /Reports/.test(x)) && mn.some(x => /Audit/.test(x)) && !mn.some(x => /Users|Devices/.test(x)), `manager: Reports + Audit, no Users/Devices (${mn.join(', ')})`);
await go('/inspections?status=pool'); const mp = await titles();
check(['Kiln test A', 'Kiln test B', 'Raw mill test C'].every(x => mp.includes(x)), 'manager: sees every team');
await go('/settings');
const mc = (await page.locator('.content .card h2, .content .card .card-title, .content .card h3').allTextContents()).join(' | ');
check(!/Departments|Plan & billing|Reports & e-mail/.test(mc), 'manager: no administrator settings');
check(await redirected('/users') && await redirected('/devices'), 'manager: /users and /devices send back to the dashboard');
await signOut();

await browser.close();
check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 4).join(' | ') : ''));
console.log(ok ? 'ALL PASSED' : 'SOME CHECKS FAILED');
process.exit(ok ? 0 : 1);
