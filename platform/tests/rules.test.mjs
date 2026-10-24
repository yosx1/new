// Security-rule tests. Run with: npm run test:rules (starts the Firestore emulator).
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, writeBatch, serverTimestamp, addDoc, collection, deleteDoc, increment } from 'firebase/firestore';

let env;
const user = (uid, role, extra = {}) => ({ name: uid, email: `${uid}@kcp.iq`, role, discipline: null, departmentId: null, active: true, ...extra });
const SD = 'SD-2026-A';
const summary = (o = {}) => ({ total: 2, ok: 0, notok: 0, fixed: 0, pending: 2, ...o });
const inspection = (o = {}) => ({
  code: 'CR-2026-0001', shutdownId: SD, shutdownName: 'Annual shutdown 2026', title: 'Kiln main drive', equipmentId: 'E1', departmentId: 'KLN',
  discipline: 'electrical', parts: [{ id: 'p1', name: 'Motor' }, { id: 'p2', name: 'MCC panel' }], results: {}, summary: summary(),
  status: 'pool', createdBy: 'elec', createdByName: 'elec', createdAt: 1, updatedAt: 1, approval: null, rejection: null, docVersion: 1, ...o,
});
const ID = `${SD}_E1_electrical`;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-coldrun',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'config/setup'), { adminUid: 'admin' });
    await setDoc(doc(db, 'config/shutdown'), { currentId: SD });
    await setDoc(doc(db, `shutdowns/${SD}`), { name: 'Annual shutdown 2026', year: 2026, status: 'open' });
    for (const d of ['RML', 'KLN', 'CLR', 'CML']) await setDoc(doc(db, `departments/${d}`), { code: d, name: { en: d, ar: d }, order: 1, active: true });
    await setDoc(doc(db, 'equipment/E1'), { name: 'Kiln main drive', departmentId: 'KLN', parts: { electrical: ['Motor', 'MCC panel'], mechanical: ['Gearbox'] }, active: true });
    for (const [uid, role, extra] of [
      ['admin', 'admin'], ['mgr', 'manager'],
      ['elec', 'member', { discipline: 'electrical', departmentId: 'KLN' }],
      ['elec2', 'member', { discipline: 'electrical', departmentId: null }],
      ['elecRM', 'member', { discipline: 'electrical', departmentId: 'RML' }],
      ['mech', 'member', { discipline: 'mechanical', departmentId: 'KLN' }],
    ]) await setDoc(doc(db, 'users', uid), user(uid, role, extra));
    await setDoc(doc(db, 'users/gone'), user('gone', 'member', { discipline: 'electrical', departmentId: 'KLN', active: false }));
    await setDoc(doc(db, `inspections/${ID}`), inspection());
  });
});

const as = uid => env.authenticatedContext(uid).firestore();
const ins = (db, id = ID) => doc(db, 'inspections', id);
const setAs = (status, extra = {}) => env.withSecurityRulesDisabled(ctx => updateDoc(ins(ctx.firestore()), { status, ...extra }));

test('first administrator bootstrap only works once', async () => {
  await env.withSecurityRulesDisabled(async ctx => deleteDoc(doc(ctx.firestore(), 'config/setup')));
  const db = as('first');
  const b = writeBatch(db);
  b.set(doc(db, 'users/first'), user('first', 'admin'));
  b.set(doc(db, 'config/setup'), { adminUid: 'first' });
  await assertSucceeds(b.commit());
  const db2 = as('second');
  const b2 = writeBatch(db2);
  b2.set(doc(db2, 'users/second'), user('second', 'admin'));
  b2.set(doc(db2, 'config/setup'), { adminUid: 'second' });
  await assertFails(b2.commit());
});

test('users cannot raise their own role or change their team; deactivated users lose access', async () => {
  await assertFails(updateDoc(doc(as('elec'), 'users/elec'), { role: 'admin' }));
  await assertFails(updateDoc(doc(as('elec'), 'users/elec'), { discipline: 'mechanical' }));
  await assertSucceeds(updateDoc(doc(as('elec'), 'users/elec'), { lang: 'en' }));
  await assertSucceeds(getDoc(doc(as('gone'), 'users/gone')));
  await assertFails(getDoc(ins(as('gone'))));
  await assertFails(getDoc(ins(env.unauthenticatedContext().firestore())));
  // a team member needs a discipline; unknown roles are refused
  await assertFails(setDoc(doc(as('admin'), 'users/x'), user('x', 'member')));
  await assertFails(setDoc(doc(as('admin'), 'users/y'), user('y', 'viewer')));
  await assertSucceeds(setDoc(doc(as('admin'), 'users/z'), user('z', 'member', { discipline: 'production', departmentId: 'CML' })));
});

test('creating: own discipline and department only, one per equipment + discipline + shutdown', async () => {
  const mk = (uid, d = 'electrical', o = {}) => setDoc(ins(as(uid), `${SD}_E1_${d}`), inspection({ discipline: d, createdBy: uid, ...o }));
  await env.withSecurityRulesDisabled(ctx => deleteDoc(ins(ctx.firestore())));
  await assertFails(mk('mech'));                            // electrical parts, mechanical engineer
  await assertFails(mk('elecRM'));                          // other department
  await assertFails(setDoc(ins(as('elec'), 'random-id'), inspection({ createdBy: 'elec' }))); // id must be shutdown_equipment_discipline
  await assertFails(mk('elec', 'electrical', { title: 'Something else' }));    // title = equipment name
  await assertFails(mk('elec', 'electrical', { shutdownId: 'SD-OLD' }));        // current shutdown only
  await assertFails(mk('elec', 'electrical', { status: 'approved' }));
  await assertSucceeds(mk('elec'));
  await assertSucceeds(mk('mech', 'mechanical'));
  await assertFails(mk('elec2'));                           // a second one for the same equipment + discipline
  await assertSucceeds(mk('mgr', 'instrumentation'));      // the manager may start any discipline
});

test('checking parts: the team works it, other teams cannot', async () => {
  const save = (uid, extra) => updateDoc(ins(as(uid)), { 'results.p1': { status: 'ok', note: '', photoIds: [], by: uid }, summary: summary({ ok: 1, pending: 1 }), docVersion: 2, ...extra });
  await assertFails(save('mech'));
  await assertFails(save('elecRM'));
  await assertFails(save('elec', { docVersion: 1 }));       // stale version
  await assertFails(save('elec', { title: 'renamed' }));    // identity is fixed
  await assertSucceeds(save('elec2'));                      // colleague, all departments
});

test('submitting: corrective needs every part checked and a work order; waiting approval needs every Not OK fixed', async () => {
  await assertFails(updateDoc(ins(as('elec')), { status: 'waiting_approval', summary: summary({ ok: 1, pending: 1 }), docVersion: 2 }));
  await assertFails(updateDoc(ins(as('elec')), { status: 'waiting_approval', summary: summary({ ok: 1, notok: 1, pending: 0 }), docVersion: 2 }));
  const toCorrective = { status: 'corrective', summary: summary({ ok: 1, notok: 1, pending: 0 }), docVersion: 2 };
  await assertFails(updateDoc(ins(as('elec')), toCorrective));                               // no work order
  await assertFails(updateDoc(ins(as('elec')), { ...toCorrective, workOrder: '' }));
  await assertFails(updateDoc(ins(as('elec')), { ...toCorrective, workOrder: 'x'.repeat(41) }));
  await assertFails(updateDoc(ins(as('elec')), { ...toCorrective, workOrder: 153 }));
  await assertSucceeds(updateDoc(ins(as('elec')), { ...toCorrective, workOrder: 'WO-2026-0153' }));
  await assertFails(updateDoc(ins(as('elec')), { workOrder: null, docVersion: 3 }));         // cannot be removed
  await assertFails(updateDoc(ins(as('mech')), { workOrder: 'WO-1', docVersion: 3 }));       // other team
  await assertSucceeds(updateDoc(ins(as('elec')), { workOrder: 'WO-2026-0154', docVersion: 3 })); // corrected by the team
  await assertFails(updateDoc(ins(as('elec')), { status: 'approved', docVersion: 4 }));
  await assertSucceeds(updateDoc(ins(as('elec')), { status: 'waiting_approval', summary: summary({ ok: 1, notok: 1, fixed: 1, pending: 0 }), docVersion: 4 }));
  await assertFails(updateDoc(ins(as('elec')), { 'results.p1': { status: 'notok' }, docVersion: 5 })); // locked while waiting
  await assertFails(updateDoc(ins(as('elec')), { workOrder: 'WO-9', docVersion: 5 }));       // and so is the work order
});

test('approval and sending back: Cold Run Test Manager or administrator only', async () => {
  await setAs('waiting_approval', { summary: summary({ ok: 2, pending: 0 }), docVersion: 3 });
  const approve = uid => updateDoc(ins(as(uid)), { status: 'approved', approval: { by: uid, byName: uid, at: 1, comment: '' }, docVersion: 4 });
  await assertFails(approve('elec'));
  await assertFails(updateDoc(ins(as('mgr')), { status: 'approved', approval: { by: 'admin', at: 1 }, docVersion: 4 })); // in own name only
  await assertSucceeds(approve('mgr'));
  await assertFails(updateDoc(ins(as('mgr')), { status: 'pool', rejection: { by: 'mgr', reason: 'x' }, docVersion: 5 })); // reason too short
  await assertSucceeds(updateDoc(ins(as('admin')), { status: 'pool', approval: null, rejection: { by: 'admin', reason: 'Recheck the motor' }, docVersion: 5 }));
});

test('archiving: approved inspections only, by the manager or administrator', async () => {
  const arch = uid => updateDoc(ins(as(uid)), { status: 'archived', archivedAt: serverTimestamp(), docVersion: 2 });
  await assertFails(arch('mgr'));                           // still in the pool
  await setAs('approved');
  await assertFails(arch('elec'));
  await assertSucceeds(arch('mgr'));
  await assertFails(updateDoc(ins(as('admin')), { status: 'pool', docVersion: 3 })); // done is final
});

test('shutdown: managers start and close it; members cannot', async () => {
  await assertFails(updateDoc(doc(as('elec'), `shutdowns/${SD}`), { status: 'closed', closedBy: 'elec' }));
  await assertSucceeds(updateDoc(doc(as('mgr'), `shutdowns/${SD}`), { status: 'closed', closedBy: 'mgr', closedByName: 'mgr', closedAt: serverTimestamp(), archived: 1 }));
  await assertFails(setDoc(doc(as('elec'), 'config/shutdown'), { currentId: SD }));
  const m = as('mgr');
  const b = writeBatch(m);
  b.set(doc(m, 'shutdowns/SD-2027-B'), { name: 'Annual shutdown 2027', year: 2027, status: 'open' });
  b.set(doc(m, 'config/shutdown'), { currentId: 'SD-2027-B' });
  await assertSucceeds(b.commit());
  await assertFails(setDoc(doc(as('mgr'), 'config/shutdown'), { currentId: 'does-not-exist' }));
});

test('equipment: managers and administrators manage it, with valid data only', async () => {
  const e = { name: 'Cooler fan', departmentId: 'CLR', parts: { mechanical: ['Impeller'] }, active: true, updatedAt: serverTimestamp() };
  await assertFails(setDoc(doc(as('elec'), 'equipment/E2'), e));
  await assertSucceeds(setDoc(doc(as('mgr'), 'equipment/E2'), e));
  await assertFails(setDoc(doc(as('mgr'), 'equipment/E3'), { ...e, departmentId: 'NOPE' }));
  await assertFails(setDoc(doc(as('mgr'), 'equipment/E4'), { ...e, parts: { welding: ['x'] } }));
  await assertFails(setDoc(doc(as('mgr'), 'equipment/E5'), { ...e, tag: 'x' }));
});

test('audit trail is append-only', async () => {
  const db = as('elec');
  const r = await assertSucceeds(addDoc(collection(db, 'audit'), { uid: 'elec', action: 'x', at: serverTimestamp() }));
  await assertFails(updateDoc(doc(as('admin'), 'audit', r.id), { action: 'y' }));
  await assertFails(deleteDoc(doc(as('admin'), 'audit', r.id)));
  await assertFails(addDoc(collection(db, 'audit'), { uid: 'someone-else', action: 'x', at: serverTimestamp() }));
  await assertFails(getDoc(doc(as('elec'), 'audit', r.id)));
  await assertSucceeds(getDoc(doc(as('mgr'), 'audit', r.id)));
});

test('devices: a revoked device cannot restore itself', async () => {
  const db = as('elec');
  await assertSucceeds(setDoc(doc(db, 'devices/elec_dev1'), { uid: 'elec', revoked: false }));
  await assertSucceeds(updateDoc(doc(as('admin'), 'devices/elec_dev1'), { revoked: true }));
  await assertFails(updateDoc(doc(db, 'devices/elec_dev1'), { revoked: false }));
  await assertFails(setDoc(doc(db, 'devices/mech_dev1'), { uid: 'elec', revoked: false }));
});

test('notifications: only well-formed in-app messages to existing users', async () => {
  const db = as('mgr');
  const ok = { toUid: 'elec', title: { en: 'Hi', ar: 'مرحبا' }, link: `/inspections/${ID}`, read: false, createdAt: serverTimestamp() };
  await assertSucceeds(addDoc(collection(db, 'notifications'), ok));
  await assertFails(addDoc(collection(db, 'notifications'), { ...ok, link: 'https://evil.example' }));
  await assertFails(addDoc(collection(db, 'notifications'), { ...ok, link: '//evil.example' }));
  await assertFails(addDoc(collection(db, 'notifications'), { ...ok, link: '/\\evil.example' }));   // backslash open-redirect trick
  await assertFails(addDoc(collection(db, 'notifications'), { ...ok, link: '/x\njavascript:1' }));
  await assertFails(addDoc(collection(db, 'notifications'), { ...ok, toUid: 'nobody' }));
  await assertFails(addDoc(collection(db, 'notifications'), { ...ok, read: true }));
  await assertFails(addDoc(collection(db, 'notifications'), { ...ok, extra: 1 }));
  const r = await addDoc(collection(db, 'notifications'), ok);
  await assertFails(getDoc(doc(as('mech'), 'notifications', r.id)));
  await assertSucceeds(updateDoc(doc(as('elec'), 'notifications', r.id), { read: true }));
  await assertFails(updateDoc(doc(as('elec'), 'notifications', r.id), { link: '/x' }));
});

test('invitations: admin invites by email; only that verified email can claim, once, with the invited role and team', async () => {
  const adb = as('admin');
  const inv = { email: 'new@kcp.iq', name: 'New', role: 'member', discipline: 'electrical', departmentId: 'KLN', phone: '', invitedBy: 'admin', createdAt: 1 };
  await assertFails(setDoc(doc(as('mgr'), 'invites/new@kcp.iq'), { ...inv, invitedBy: 'mgr' }));
  await assertFails(setDoc(doc(adb, 'invites/New@kcp.iq'), { ...inv, email: 'New@kcp.iq' }));
  await assertFails(setDoc(doc(adb, 'invites/new@kcp.iq'), { ...inv, role: 'owner' }));
  await assertSucceeds(setDoc(doc(adb, 'invites/new@kcp.iq'), inv));

  const profile = { name: 'New', email: 'new@kcp.iq', role: 'member', discipline: 'electrical', departmentId: 'KLN', phone: '', active: true, lang: 'ar', createdAt: serverTimestamp(), createdBy: 'admin' };
  const claim = (db, uid, p = profile) => { const b = writeBatch(db); b.set(doc(db, 'users', uid), p); b.delete(doc(db, 'invites/new@kcp.iq')); return b.commit(); };
  const ctx = (uid, email, verified = true) => env.authenticatedContext(uid, { email, email_verified: verified }).firestore();

  await assertFails(claim(ctx('x1', 'other@kcp.iq'), 'x1'));                         // different email
  await assertFails(claim(ctx('x2', 'new@kcp.iq', false), 'x2'));                    // unverified email
  await assertFails(claim(ctx('x3', 'new@kcp.iq'), 'x3', { ...profile, role: 'admin' }));          // role escalation
  await assertFails(claim(ctx('x3', 'new@kcp.iq'), 'x3', { ...profile, discipline: 'mechanical' })); // other team
  await assertFails(setDoc(doc(ctx('x4', 'new@kcp.iq'), 'users/x4'), profile));      // must consume the invitation
  await assertSucceeds(getDoc(doc(ctx('x5', 'NEW@kcp.iq'), 'invites/new@kcp.iq')));
  await assertSucceeds(claim(ctx('x5', 'NEW@kcp.iq'), 'x5'));
  await assertFails(claim(ctx('x6', 'new@kcp.iq'), 'x6'));                           // already used
});

test('administrator: delete any inspection, rename a shutdown and the name on its inspections', async () => {
  await setAs('approved');
  await assertFails(deleteDoc(ins(as('mgr'))));
  await assertFails(deleteDoc(ins(as('elec'))));
  // rename: admin only, name + year only, valid values
  const sd = doc(as('admin'), `shutdowns/${SD}`);
  await assertFails(updateDoc(doc(as('mgr'), `shutdowns/${SD}`), { name: 'Kiln overhaul 2026' }));
  await assertFails(updateDoc(sd, { name: '' }));
  await assertFails(updateDoc(sd, { year: 1990 }));
  await assertFails(updateDoc(sd, { status: 'closed' }));
  await assertSucceeds(updateDoc(sd, { name: 'Kiln overhaul 2026', year: 2026 }));
  // the inspection may only take the shutdown's real name, and nothing else may change with it
  await assertFails(updateDoc(ins(as('admin')), { shutdownName: 'Something else', docVersion: 2 }));
  await assertFails(updateDoc(ins(as('admin')), { shutdownName: 'Kiln overhaul 2026', title: 'x', docVersion: 2 }));
  await assertFails(updateDoc(ins(as('mgr')), { shutdownName: 'Kiln overhaul 2026', docVersion: 2 }));
  await assertSucceeds(updateDoc(ins(as('admin')), { shutdownName: 'Kiln overhaul 2026', docVersion: 2 }));
  await assertSucceeds(deleteDoc(ins(as('admin'))));
});

test('counters: only the inspection-code counter, only counting up by one', async () => {
  await assertSucceeds(setDoc(doc(as('elec'), 'counters/CR-2026'), { value: 1, updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(as('elec'), 'counters/CR-2026'), { value: 5, updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(as('elec'), 'counters/anything'), { value: 1 }));
  await assertFails(setDoc(doc(as('elec'), 'counters/CR-2027'), { value: 1, junk: 'x' }));
});

test('nothing outside the data model can be read or written', async () => {
  for (const path of ['templates/T1', 'defects/D1', 'secrets/x', 'inspections/I1/results/a']) {
    await assertFails(setDoc(doc(as('admin'), path), { x: 1 }));
    await assertFails(getDoc(doc(as('admin'), path)));
  }
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users/admin')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'equipment/E1')));
});

test('departments: the administrator manages them with valid data; nobody deletes them', async () => {
  const d = { code: 'CML5', name: { en: 'Cement Mill 5', ar: 'طاحونة السمنت 5' }, order: 11, active: true, createdAt: serverTimestamp(), createdBy: 'admin' };
  await assertFails(setDoc(doc(as('mgr'), 'departments/CML5'), d));
  await assertFails(setDoc(doc(as('admin'), 'departments/X1'), { ...d, name: { en: '', ar: '' } }));
  await assertFails(setDoc(doc(as('admin'), 'departments/X2'), { ...d, order: '3' }));
  await assertSucceeds(setDoc(doc(as('admin'), 'departments/CML5'), d));
  await assertSucceeds(updateDoc(doc(as('admin'), 'departments/CML5'), { active: false, updatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(doc(as('admin'), 'departments/CML5')));
});

test('usage: everyone adds to the daily counts, only upwards; only the administrator reads them', async () => {
  const add = (uid, o = {}) => setDoc(doc(as(uid), 'usage/2026-10-21'), { reads: increment(10), writes: increment(2), deletes: increment(0), updatedAt: serverTimestamp(), ...o }, { merge: true });
  await assertSucceeds(add('elec'));
  await assertSucceeds(add('mgr'));
  await assertFails(add('gone'));
  await assertFails(add('elec', { reads: -5 }));
  await assertFails(add('elec', { reads: increment(500000) }));
  await assertFails(add('elec', { alerts: { reads: 100 } }));
  await assertFails(add('elec', { other: 1 }));
  await assertFails(setDoc(doc(as('elec'), 'usage/not-a-day'), { reads: 1, writes: 1, deletes: 0, updatedAt: serverTimestamp() }));
  await assertFails(getDoc(doc(as('mgr'), 'usage/2026-10-21')));
  const s = await assertSucceeds(getDoc(doc(as('admin'), 'usage/2026-10-21')));
  if (s.data().reads !== 20 || s.data().writes !== 4) throw new Error('counts ' + JSON.stringify(s.data()));
  await assertFails(deleteDoc(doc(as('admin'), 'usage/2026-10-21')));
});
