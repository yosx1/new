import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../src/lib/csv';
import { equipmentToCsv, planCsvImport } from '../../src/lib/equipmentCsv';
import type { Department, Equipment } from '../../src/types';

describe('parseCsv', () => {
  it('reads quotes, escaped quotes and embedded separators', () => {
    expect(parseCsv('a,"b, c","say ""hi"""\n1,2,3')).toEqual([['a', 'b, c', 'say "hi"'], ['1', '2', '3']]);
  });
  it('handles a UTF-8 BOM, CRLF and semicolons (Excel in Arabic/European locales)', () => {
    expect(parseCsv('﻿x;y\r\n1;2\r\n')).toEqual([['x', 'y'], ['1', '2']]);
  });
  it('keeps new lines inside quotes and drops empty rows', () => {
    expect(parseCsv('"two\nlines",b\n\n,\n')).toEqual([['two\nlines', 'b']]);
  });
});

const depts = [
  { id: 'KLN1', code: 'KLN1', name: { en: 'Kiln 1', ar: 'الفرن 1' }, order: 1, active: true },
  { id: 'RML1', code: 'RML1', name: { en: 'Raw Mill 1', ar: 'طاحونة المواد الأولية 1' }, order: 2, active: true },
] as Department[];
const eqs = [{ id: 'E1', name: 'Main drive', departmentId: 'KLN1', active: true, parts: { mechanical: ['Gearbox'], electrical: ['Motor'], instrumentation: [], production: [] } }] as unknown as Equipment[];

describe('equipment CSV', () => {
  it('reads the Code column and matches equipment by code (renaming it if the name changed)', () => {
    const coded = [{ ...eqs[0], id: 'K1M011', code: 'K1M011', name: 'ID fan' }] as Equipment[];
    const csv = 'Department,Code,Equipment,Part type,Part\nKiln 1,k1m011,ID Fan (main),Electrical,Motor insulation\nKiln 1,K1M012,By-pass fan,Mechanical,Impeller clean\n';
    const plan = planCsvImport(csv, coded, depts);
    expect(plan.errors).toEqual([]);
    expect(plan.items.map(i => [i.id, i.code, i.name])).toEqual([['K1M011', 'K1M011', 'ID Fan (main)'], [null, 'K1M012', 'By-pass fan']]);
  });
  it('refuses the same code for two different equipment', () => {
    const plan = planCsvImport('Department,Code,Equipment,Part type,Part\nKiln 1,K1M011,ID fan,Electrical,A\nKiln 1,K1M011,EP fan,Electrical,B\n', eqs, depts);
    expect(plan.errors.map(e => [e.line, e.reason])).toEqual([[3, 'code']]);
  });
  it('round-trips: download then upload changes nothing', () => {
    const plan = planCsvImport(equipmentToCsv(eqs, depts), eqs, depts);
    expect(plan.errors).toEqual([]);
    expect(plan.added).toBe(0);
    expect(plan.updated).toBe(1);
    expect(plan.items[0].parts.mechanical).toEqual(['Gearbox']);
    expect(plan.items[0].parts.electrical).toEqual(['Motor']);
  });
  it('matches departments by code, English or Arabic name and part types in both languages', () => {
    const csv = 'Department,Equipment,Part type,Part\nالفرن 1,Main drive,كهرباء,MCC\nraw mill 1,Separator,Mechanical,Rotor\n';
    const plan = planCsvImport(csv, eqs, depts);
    expect(plan.errors).toEqual([]);
    expect(plan.updated).toBe(1);
    expect(plan.added).toBe(1);
    expect(plan.items.find(i => i.id === 'E1')!.parts.electrical).toEqual(['MCC']);
  });
  it('reports bad rows with their line numbers instead of guessing', () => {
    const plan = planCsvImport('Department,Equipment,Part type,Part\nNowhere,X,Mechanical,Y\nKLN1,,Mechanical,Y\nKLN1,Fan,Plumbing,Y\n', eqs, depts);
    expect(plan.errors.map(e => [e.line, e.reason])).toEqual([[2, 'dept'], [3, 'name'], [4, 'type']]);
    expect(plan.items).toEqual([]);
  });
  it('does not duplicate a part listed twice', () => {
    const plan = planCsvImport('KLN1,Fan,Electrical,Motor\nKLN1,Fan,Electrical,Motor\n', eqs, depts);
    expect(plan.items[0].parts.electrical).toEqual(['Motor']);
  });
});
