// Security-rule tests. Run with: npm run test:rules (starts the Firestore emulator).
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, writeBatch, serverTimestamp, addDoc, collection, deleteDoc } from 'firebase/firestore';

let env;
const role = (uid, r, extra = {}) => ({ name: uid, email: `${uid}@kcp.iq`, role: r, active: true, departmentId: null, ...extra });

const summary = (o = {}) => ({
  total: 2, pass: 2, fail: 0, pending: 0, na: 0, mandatoryPending: 0, criticalFail: 0,
  openDefects: 0, openCritical: 0, awaitingVerification: 0, sections: {}, ...o,
});
const inspection = (o = {}) => ({
  code: 'CR-2026-0001', title: 't', departmentId: 'KLN', equipmentId: 'KLN-MD01', checklist: [], templateId: 'T',
  templateVersion: 1, requiredApprovals: ['mechanical'], approvals: {}, override: null, status: 'in_progress',
  summary: summary(), pools: [], createdBy: 'sup', createdAt: 1, docVersion: 1, ...o,
});

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
    await setDoc(doc(db, 'config/settings'), { overrideRoles: ['manager', 'admin'] });
    for (const [uid, r] of [['admin', 'admin'], ['sup', 'supervisor'], ['sup2', 'supervisor'], ['mgr', 'manager'],
      ['mech', 'mechanical'], ['mech2', 'mechanical'], ['elec', 'electrical'], ['prod', 'production'], ['view', 'viewer']]) {
      await setDoc(doc(db, 'users', uid), role(uid, r));
    }
    await setDoc(doc(db, 'users', 'gone'), role('gone', 'mechanical', { active: false }));
    await setDoc(doc(db, 'inspections/I1'), inspection());
    await setDoc(doc(db, 'inspections/I1/results/a'), { discipline: 'mechanical', status: 'pass', inspectorUid: 'mech', rev: 1 });
    await setDoc(doc(db, 'defects/D1'), {
      code: 'DF-1', inspectionId: 'I1', reportedBy: 'mech', reportedAt: 1, equipmentId: 'KLN-MD01', pool: 'mechanical',
      severity: 'critical', status: 'repair_completed', assignedUid: 'mech', repair: { by: 'sup', at: 1 }, verification: null,
    });
  });
});

const as = uid => env.authenticatedContext(uid).firestore();

test('first administrator bootstrap only works once', async () => {
  await env.withSecurityRulesDisabled(async ctx => deleteDoc(doc(ctx.firestore(), 'config/setup')));
  const db = as('first');
  const b = writeBatch(db);
  b.set(doc(db, 'users/first'), role('first', 'admin'));
  b.set(doc(db, 'config/setup'), { adminUid: 'first' });
  await assertSucceeds(b.commit());
  const db2 = as('second');
  const b2 = writeBatch(db2);
  b2.set(doc(db2, 'users/second'), role('second', 'admin'));
  b2.set(doc(db2, 'config/setup'), { adminUid: 'second' });
  await assertFails(b2.commit());
});

test('users cannot raise their own role; deactivated users lose access', async () => {
  await assertFails(updateDoc(doc(as('mech'), 'users/mech'), { role: 'admin' }));
  await assertSucceeds(updateDoc(doc(as('mech'), 'users/mech'), { lang: 'en' }));
  await assertSucceeds(getDoc(doc(as('gone'), 'users/gone'))); // can see own (inactive) profile
  await assertFails(getDoc(doc(as('gone'), 'inspections/I1')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'inspections/I1')));
});

test('only leads create inspections', async () => {
  const data = inspection({ status: 'maintenance_completed', createdBy: 'mech' });
  await assertFails(setDoc(doc(as('mech'), 'inspections/I2'), data));
  await assertSucceeds(setDoc(doc(as('sup'), 'inspections/I2'), { ...data, createdBy: 'sup' }));
});

test('results: own discipline only, and stale revisions are rejected', async () => {
  const base = { discipline: 'electrical', status: 'pass', inspectorUid: 'mech', rev: 1 };
  await assertFails(setDoc(doc(as('mech'), 'inspections/I1/results/b'), base));
  await assertSucceeds(setDoc(doc(as('elec'), 'inspections/I1/results/b'), { ...base, inspectorUid: 'elec' }));
  // mech2 continues mech's work (pool hand-over) with the next revision
  await assertSucceeds(setDoc(doc(as('mech2'), 'inspections/I1/results/a'), { discipline: 'mechanical', status: 'fail', inspectorUid: 'mech2', rev: 2 }));
  // an offline edit based on rev 1 must not overwrite rev 2
  await assertFails(setDoc(doc(as('mech'), 'inspections/I1/results/a'), { discipline: 'mechanical', status: 'pass', inspectorUid: 'mech', rev: 2 }));
});

test('approval keys are restricted to the approver discipline', async () => {
  const at = { decision: 'approved', at: 1 };
  await assertFails(updateDoc(doc(as('elec'), 'inspections/I1'), { approvals: { mechanical: { ...at, by: 'elec' } }, docVersion: 2 }));
  await assertFails(updateDoc(doc(as('mech'), 'inspections/I1'), { approvals: { mechanical: { ...at, by: 'mech2' } }, docVersion: 2 }));
  await assertSucceeds(updateDoc(doc(as('mech'), 'inspections/I1'), { approvals: { mechanical: { ...at, by: 'mech' } }, docVersion: 2 }));
});

test('final approval: leads only, blocked by critical failures unless a manager overrides', async () => {
  const final = by => ({ approvals: { mechanical: { decision: 'approved', by: 'mech' }, final: { decision: 'approved', by } } });
  await env.withSecurityRulesDisabled(async ctx => updateDoc(doc(ctx.firestore(), 'inspections/I1'),
    { approvals: { mechanical: { decision: 'approved', by: 'mech' } }, summary: summary({ criticalFail: 1, fail: 1, pass: 1 }) }));
  await assertFails(updateDoc(doc(as('prod'), 'inspections/I1'), { ...final('prod'), status: 'approved', docVersion: 2 }));
  await assertFails(updateDoc(doc(as('sup'), 'inspections/I1'), { ...final('sup'), status: 'approved', docVersion: 2 }));
  const override = by => ({ by, justification: 'Approved disposition MOC-2026-17', at: 1 });
  await assertFails(updateDoc(doc(as('sup'), 'inspections/I1'), { ...final('sup'), override: override('sup'), status: 'approved', docVersion: 2 }));
  await assertSucceeds(updateDoc(doc(as('mgr'), 'inspections/I1'), { ...final('mgr'), override: override('mgr'), status: 'approved', docVersion: 2 }));
});

test('docVersion must advance (no blind overwrite of inspection)', async () => {
  await assertFails(updateDoc(doc(as('mech'), 'inspections/I1'), { pools: [] }));
  await assertFails(updateDoc(doc(as('mech'), 'inspections/I1'), { checklist: [{}], docVersion: 2 }));
});

test('defects: technicians cannot close; the repairer cannot verify own repair', async () => {
  const close = by => ({ status: 'closed', verification: { result: 'pass', by, at: 1 } });
  await assertFails(updateDoc(doc(as('mech'), 'defects/D1'), close('mech')));
  await assertFails(updateDoc(doc(as('sup'), 'defects/D1'), close('sup'))); // sup did the repair
  await assertSucceeds(updateDoc(doc(as('sup2'), 'defects/D1'), close('sup2')));
  await assertFails(updateDoc(doc(as('mech'), 'defects/D1'), { status: 'open' })); // reopen = leads only
  await assertSucceeds(updateDoc(doc(as('sup'), 'defects/D1'), { status: 'open', verification: null }));
});

test('defect pool: other disciplines cannot work it; pool members can take it over', async () => {
  await assertFails(updateDoc(doc(as('elec'), 'defects/D1'), { status: 'in_progress' }));
  await assertSucceeds(updateDoc(doc(as('mech2'), 'defects/D1'), { assignedUid: 'mech2', assignedName: 'mech2' }));
  await assertFails(updateDoc(doc(as('mech2'), 'defects/D1'), { severity: 'low' }));
  // a repair can only be recorded in one's own name (prevents dodging independent verification)
  await assertFails(updateDoc(doc(as('mech2'), 'defects/D1'), { repair: { by: 'mech', at: 1 } }));
  await assertSucceeds(updateDoc(doc(as('mech2'), 'defects/D1'), { repair: { by: 'mech2', at: 1 } }));
});

test('audit trail is append-only', async () => {
  const db = as('mech');
  const r = await assertSucceeds(addDoc(collection(db, 'audit'), { uid: 'mech', action: 'x', at: serverTimestamp() }));
  await assertFails(updateDoc(doc(as('admin'), 'audit', r.id), { action: 'y' }));
  await assertFails(deleteDoc(doc(as('admin'), 'audit', r.id)));
  await assertFails(addDoc(collection(db, 'audit'), { uid: 'someone-else', action: 'x', at: serverTimestamp() }));
});

test('devices: a revoked device cannot restore itself', async () => {
  const db = as('mech');
  await assertSucceeds(setDoc(doc(db, 'devices/mech_dev1'), { uid: 'mech', revoked: false }));
  await assertSucceeds(updateDoc(doc(as('admin'), 'devices/mech_dev1'), { revoked: true }));
  await assertFails(updateDoc(doc(db, 'devices/mech_dev1'), { revoked: false }));
  await assertFails(setDoc(doc(db, 'devices/elec_dev1'), { uid: 'mech', revoked: false }));
});

test('viewers are read-only', async () => {
  await assertSucceeds(getDoc(doc(as('view'), 'inspections/I1')));
  await assertFails(addDoc(collection(as('view'), 'defects'), { reportedBy: 'view', status: 'open', verification: null, repair: null }));
});
