/* Minimal .xlsx writer (Office Open XML) — enough for report tables: several sheets, a title block,
   a bold frozen header row, sensible column widths, numbers kept as numbers and right-to-left sheets. */
import { strToU8, zipSync } from 'fflate';

export type Cell = string | number | null | undefined;
export interface Sheet { name: string; title?: string[]; header: string[]; rows: Cell[][] }

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
  // XML 1.0 forbids most control characters
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const col = (i: number) => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };
// Sheet names: max 31 chars, no []:*?/\ and unique.
const sheetName = (n: string, used: Set<string>) => {
  let base = n.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31).trim() || 'Sheet';
  for (let k = 2, s = base; ; k++) { if (!used.has(s.toLowerCase())) { used.add(s.toLowerCase()); return s; } s = `${base.slice(0, 28)} ${k}`; }
};

function sheetXml(sh: Sheet, rtl: boolean) {
  const rows: string[] = [];
  let r = 0;
  const cell = (c: number, v: Cell, style: number) => {
    const ref = col(c) + (r + 1);
    if (v == null || v === '') return style ? `<c r="${ref}" s="${style}"/>` : '';
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}" s="${style}"><v>${v}</v></c>`;
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
  };
  for (const [k, line] of (sh.title ?? []).entries()) { rows.push(`<row r="${r + 1}">${cell(0, line, k === 0 ? 3 : 4)}</row>`); r++; }
  if (sh.title?.length) r++; // blank line before the table
  const headerRow = r + 1;
  rows.push(`<row r="${headerRow}">${sh.header.map((h, c) => cell(c, h, 1)).join('')}</row>`); r++;
  for (const row of sh.rows) { rows.push(`<row r="${r + 1}">${row.map((v, c) => cell(c, v, 2)).join('')}</row>`); r++; }

  const widths = sh.header.map((h, c) => Math.min(60, Math.max(8, ...[h, ...sh.rows.map(x => x[c])].map(v => String(v ?? '').length + 2))));
  const last = col(Math.max(0, sh.header.length - 1));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"${rtl ? ' rightToLeft="1"' : ''}><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>
<sheetData>${rows.join('')}</sheetData>
${sh.rows.length ? `<autoFilter ref="A${headerRow}:${last}${headerRow + sh.rows.length}"/>` : ''}
</worksheet>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF667085"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B2A5B"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border/><border><left style="thin"><color rgb="FFE2E7EF"/></left><right style="thin"><color rgb="FFE2E7EF"/></right><top style="thin"><color rgb="FFE2E7EF"/></top><bottom style="thin"><color rgb="FFE2E7EF"/></bottom></border></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="5"><xf/><xf fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf><xf borderId="1" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf><xf fontId="2" applyFont="1"/><xf fontId="3" applyFont="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

export function buildXlsx(sheets: Sheet[], rtl = false): Uint8Array {
  const used = new Set<string>();
  const names = sheets.map(s => sheetName(s.name, used));
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
<definedNames>${sheets.map((s, i) => s.rows.length ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(names[i]).replace(/'/g, "''")}'!$A$${(s.title?.length ? s.title.length + 1 : 0) + 1}:$${col(Math.max(0, s.header.length - 1))}$${(s.title?.length ? s.title.length + 1 : 0) + 1 + s.rows.length}</definedName>` : '').join('')}</definedNames></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    'xl/styles.xml': strToU8(STYLES),
  };
  sheets.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s, rtl)); });
  return zipSync(files, { level: 6 });
}

export function downloadXlsx(fileName: string, sheets: Sheet[], rtl = false) {
  const blob = new Blob([buildXlsx(sheets, rtl)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName.replace(/[\\/:*?"<>|]/g, '-');
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
