import { describe, expect, it } from 'vitest';
import { can, completion, inMyPool, inspectionId, myTeam, statusAfterWork, summarize } from '../../src/lib/rules';
import type { Inspection, PartResult, UserProfile } from '../../src/types';

const u = (o: Partial<UserProfile>) => ({ id: 'u', name: 'u', email: 'u@x', role: 'member', active: true, discipline: 'electrical', departmentId: 'KLN1', ...o }) as UserProfile;
const insp = (o: Partial<Inspection> = {}) => ({ discipline: 'electrical', departmentId: 'KLN1', status: 'pool', ...o }) as Inspection;
const r = (status: PartResult['status'], fix?: object) => ({ status, note: '', photoIds: [], fix: fix ?? null }) as unknown as PartResult;

describe('summarize / statusAfterWork', () => {
  const parts = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  it('counts pending, OK, Not OK and fixed', () => {
    expect(summarize(parts, { a: r('ok'), b: r('notok', { by: 'x' }) })).toEqual({ total: 3, ok: 1, notok: 1, fixed: 1, pending: 1 });
  });
  it('a cleared part counts as pending again', () => {
    expect(summarize(parts, { a: r('pending'), b: r('ok'), c: r('ok') }).pending).toBe(1);
  });
  it('unchecked parts keep it in the pool', () => expect(statusAfterWork({ total: 2, ok: 1, notok: 0, fixed: 0, pending: 1 })).toBe('pool'));
  it('open Not OK parts go to corrective maintenance', () => expect(statusAfterWork({ total: 2, ok: 1, notok: 1, fixed: 0, pending: 0 })).toBe('corrective'));
  it('all OK or fixed goes to approval', () => expect(statusAfterWork({ total: 2, ok: 1, notok: 1, fixed: 1, pending: 0 })).toBe('waiting_approval'));
  it('completion is the share of checked parts', () => {
    expect(completion({ total: 4, ok: 1, notok: 1, fixed: 0, pending: 2 })).toBe(50);
    expect(completion({ total: 0, ok: 0, notok: 0, fixed: 0, pending: 0 })).toBe(0);
  });
});

describe('roles', () => {
  const admin = u({ role: 'admin', discipline: null, departmentId: null });
  const mgr = u({ role: 'manager', discipline: null, departmentId: null });
  const elecKiln = u({});
  const elecAll = u({ departmentId: null });
  const mechKiln = u({ discipline: 'mechanical' });
  it('only the administrator manages the system', () => {
    expect([admin, mgr, elecKiln].map(can.manageSystem)).toEqual([true, false, false]);
  });
  it('managers and administrators approve and see reports; members do not', () => {
    expect([admin, mgr, elecKiln].map(can.approve)).toEqual([true, true, false]);
    expect([admin, mgr, elecKiln].map(can.seeReports)).toEqual([true, true, false]);
  });
  it('a member sees only their discipline, and their department when they have one', () => {
    expect(myTeam(elecKiln, insp())).toBe(true);
    expect(myTeam(elecKiln, insp({ departmentId: 'RML1' }))).toBe(false);
    expect(myTeam(elecAll, insp({ departmentId: 'RML1' }))).toBe(true);
    expect(myTeam(mechKiln, insp())).toBe(false);
    expect(myTeam(mgr, insp({ discipline: 'production' }))).toBe(true);
  });
  it('work is possible only in the pool or corrective maintenance, and only for the own team', () => {
    expect(can.work(elecKiln, insp())).toBe(true);
    expect(can.work(elecKiln, insp({ status: 'corrective' }))).toBe(true);
    expect(can.work(elecKiln, insp({ status: 'waiting_approval' }))).toBe(false);
    expect(can.work(mechKiln, insp())).toBe(false);
    expect(can.work(mgr, insp())).toBe(true);
  });
  it("the pool is a member's own open work", () => {
    expect(inMyPool(elecKiln, insp())).toBe(true);
    expect(inMyPool(mgr, insp())).toBe(false);
    expect(inMyPool(elecKiln, insp({ status: 'approved' }))).toBe(false);
  });
  it('one inspection id per shutdown, equipment and discipline', () => {
    expect(inspectionId('SD-2026-A', 'E1', 'electrical')).toBe('SD-2026-A_E1_electrical');
  });
});
