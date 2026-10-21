import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { buildXlsx } from '../../src/lib/xlsx';

describe('buildXlsx', () => {
  const files = unzipSync(buildXlsx([
    { name: 'Summary: 2026/[draft]', title: ['Cold run'], header: ['Equipment', 'Parts'], rows: [['Kiln <drive> & fan', 12], ['bad\u0001char', null]] },
    { name: 'Summary: 2026/[draft]', header: ['A'], rows: [] },
  ], true));
  it('is a complete workbook package', () => {
    for (const f of ['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']) expect(files[f], f).toBeDefined();
  });
  it('escapes XML and removes control characters', () => {
    const s = strFromU8(files['xl/worksheets/sheet1.xml']);
    expect(s).toContain('Kiln &lt;drive&gt; &amp; fan');
    expect(s).not.toMatch(/[\u0001]/);
    expect(s).toContain('<v>12</v>');
  });
  it('makes sheet names valid and unique, right-to-left when asked', () => {
    const wb = strFromU8(files['xl/workbook.xml']);
    const names = [...wb.matchAll(/<sheet [^>]*name="([^"]+)"/g)].map(m => m[1]);
    expect(names).toHaveLength(2);
    expect(new Set(names).size).toBe(2);
    names.forEach(n => { expect(n.length).toBeLessThanOrEqual(31); expect(n).not.toMatch(/[[\]:*?/\\]/); });
    expect(strFromU8(files['xl/worksheets/sheet1.xml'])).toContain('rightToLeft="1"');
  });
});
