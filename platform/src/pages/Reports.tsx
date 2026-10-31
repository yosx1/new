import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAllInspections, useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { equipmentTitle, inspectionId } from '../lib/rules';
import { downloadXlsx } from '../lib/xlsx';
import { Card, Empty, PageHead, StatusBadge } from '../components/ui';
import { EMPTY_FILTERS, Filters, applyFilters, type FilterState } from '../components/Filters';
import { Tip } from '../components/Tips';
import { Icon } from '../components/Icon';
import { DISCIPLINES, type Inspection, type InspectionStatus } from '../types';

const REPORTS = ['overview', 'discipline', 'notok', 'notstarted', 'inspections', 'people'] as const;
type R = typeof REPORTS[number];
type Cell = string | number;

export default function Reports() {
  const { t, b, fmtDate, lang } = useI18n();
  const data = useData();
  const [r, setR] = useState<R>('overview');
  const [f, setF] = useState<FilterState>({ ...EMPTY_FILTERS, shutdown: data.shutdown?.id ?? '' });
  // only a report on past shutdowns loads the Done inspections
  const all = useAllInspections(f.shutdown !== (data.shutdown?.id ?? ''));
  const insp = useMemo(() => applyFilters(all, f), [all, f]);
  const eqs = data.equipment.filter(e => e.active && (!f.dept || e.departmentId === f.dept) && (!f.eq || e.id === f.eq));
  const discs = DISCIPLINES.filter(d => !f.disc || d === f.disc);

  const report = useMemo((): { cols: string[]; rows: Cell[][]; links?: (string | null)[] } => {
    const by = (l: Inspection[], s: InspectionStatus) => l.filter(i => i.status === s).length;
    const counts = (l: Inspection[], expected: number): Cell[] => {
      const done = by(l, 'approved') + by(l, 'archived');
      return [expected, l.length, by(l, 'pool'), by(l, 'corrective'), by(l, 'waiting_approval'), by(l, 'approved'), by(l, 'archived'), expected ? Math.round((done / expected) * 100) + '%' : '—'];
    };
    const countCols = [t('rep.expected'), t('rep.started'), t('st.pool'), t('st.corrective'), t('st.waiting_approval'), t('st.approved'), t('st.archived'), t('rep.donePct')];
    switch (r) {
      case 'overview': return {
        cols: [t('c.department'), t('nav.equipment'), ...countCols],
        rows: data.departments.filter(d => !f.dept || d.id === f.dept).map(d => {
          const e = eqs.filter(x => x.departmentId === d.id);
          return [b(d.name), e.length, ...counts(insp.filter(i => i.departmentId === d.id), e.reduce((n, x) => n + discs.filter(y => x.parts?.[y]?.length).length, 0))];
        }),
      };
      case 'discipline': return {
        cols: [t('c.discipline'), t('insp.parts'), ...countCols],
        rows: discs.map(d => [t('disc.' + d), eqs.reduce((n, x) => n + (x.parts?.[d]?.length ?? 0), 0),
          ...counts(insp.filter(i => i.discipline === d), eqs.filter(x => x.parts?.[d]?.length).length)]),
      };
      case 'notok': {
        const rows: Cell[][] = []; const links: string[] = [];
        for (const i of insp) for (const p of i.parts) {
          const x = i.results[p.id];
          if (x?.status !== 'notok') continue;
          rows.push([i.title, b(data.dept(i.departmentId)?.name), t('disc.' + i.discipline), p.name, x.note, x.byName, i.workOrder ?? '', x.fix ? t('part.fixed') : t('rep.open'), x.fix?.note ?? '', x.fix?.byName ?? '', i.code, t('st.' + i.status)]);
          links.push(i.id);
        }
        return { cols: [t('c.equipment'), t('c.department'), t('c.discipline'), t('insp.part'), t('insp.problem'), t('insp.checkedBy'), t('wo.label'), t('c.status'), t('insp.fixNote'), t('insp.fixedBy'), t('insp.id'), t('rep.inspStatus')], rows, links };
      }
      case 'notstarted': {
        const sd = f.shutdown || data.shutdown?.id || '';
        const have = new Set(data.inspections.map(i => i.id));
        const rows: Cell[][] = [];
        for (const e of eqs) for (const d of discs) if (e.parts?.[d]?.length && !have.has(inspectionId(sd, e.id, d))) rows.push([equipmentTitle(e), b(data.dept(e.departmentId)?.name), t('disc.' + d), e.parts[d].length]);
        return { cols: [t('c.equipment'), t('c.department'), t('c.discipline'), t('insp.parts')], rows };
      }
      case 'inspections': return {
        cols: [t('insp.id'), t('c.equipment'), t('c.department'), t('c.discipline'), t('c.status'), t('insp.parts'), t('part.ok'), t('part.notok'), t('part.fixed'), t('part.pending'), t('wo.label'), t('insp.by'), t('insp.approvedByCol'), t('sd.title')],
        rows: insp.map(i => [i.code, i.title, b(data.dept(i.departmentId)?.name), t('disc.' + i.discipline), t('st.' + i.status), i.summary.total, i.summary.ok, i.summary.notok, i.summary.fixed, i.summary.pending, i.workOrder ?? '', i.createdByName, i.approval?.byName ?? '', i.shutdownName]),
        links: insp.map(i => i.id),
      };
      case 'people': {
        const m = new Map<string, { started: number; checked: number; notok: number; fixed: number; approved: number }>();
        const get = (n: string) => { if (!m.has(n)) m.set(n, { started: 0, checked: 0, notok: 0, fixed: 0, approved: 0 }); return m.get(n)!; };
        for (const i of insp) {
          get(i.createdByName).started++;
          if (i.approval) get(i.approval.byName).approved++;
          for (const x of Object.values(i.results)) { if (x.status !== 'pending') { get(x.byName).checked++; if (x.status === 'notok') get(x.byName).notok++; } if (x.fix) get(x.fix.byName).fixed++; }
        }
        return { cols: [t('c.name'), t('rep.started'), t('rep.checked'), t('part.notok'), t('rep.fixes'), t('rep.approvals')],
          rows: [...m.entries()].sort((a, c) => c[1].checked - a[1].checked).map(([n, v]) => [n, v.started, v.checked, v.notok, v.fixed, v.approved]) };
      }
    }
  }, [r, insp, eqs, discs, data, f, t, b]);

  const filterText = [
    f.shutdown && `${t('sd.title')}: ${data.shutdowns.find(s => s.id === f.shutdown)?.name ?? ''}`,
    f.dept && `${t('c.department')}: ${b(data.dept(f.dept)?.name)}`,
    f.eq && `${t('c.equipment')}: ${data.eq(f.eq) ? equipmentTitle(data.eq(f.eq)!) : ''}`,
    f.disc && `${t('c.discipline')}: ${t('disc.' + f.disc)}`,
    f.status && `${t('c.status')}: ${t('st.' + f.status)}`,
  ].filter(Boolean).join(' · ');
  const exportXlsx = () => downloadXlsx(`${t('rep.' + r)} ${new Date().toISOString().slice(0, 10)}.xlsx`, [{
    name: t('rep.' + r),
    title: [t('rep.' + r), `${b(data.settings.plantName)} · ${t('rep.generated')} ${fmtDate(new Date(), true)}`, `${t('c.filters')}: ${filterText || t('c.all')}`],
    header: report.cols, rows: report.rows,
  }], lang === 'ar');

  const cell = (v: Cell, k: number, row: number): ReactNode => (k === 0 && report.links?.[row]
    ? <Link to={`/inspections/${report.links[row]}`}>{v}</Link>
    : r === 'inspections' && k === 4 ? <StatusBadge status={insp[row].status} /> : v);

  return (
    <>
      <PageHead title={t('rep.title')} actions={<>
        <button className="btn primary" onClick={exportXlsx} disabled={!report.rows.length}><Icon name="download" />{t('c.exportXlsx')}</button>
        <button className="btn ghost" onClick={() => window.print()}><Icon name="printer" />{t('c.print')}</button>
      </>} />
      <Tip id="reports">{t('tip.reports')}</Tip>
      <div className="no-print">
        <div className="chips mb">{REPORTS.map(x => <button key={x} className={'chip' + (r === x ? ' on' : '')} onClick={() => setR(x)}>{t('rep.' + x)}</button>)}</div>
        <Filters value={f} onChange={setF} show={['shutdown', 'dept', 'eq', 'disc', ...(r === 'inspections' || r === 'notok' ? ['status' as const] : [])]} />
      </div>
      <h2 className="mb">{t('rep.' + r)} <small className="muted small">· {b(data.settings.plantName)} · {t('rep.generated')} {fmtDate(new Date(), true)}</small></h2>
      <Card>
        {report.rows.length === 0 ? <Empty /> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr>{report.cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>{report.rows.map((row, i) => <tr key={i}>{row.map((v, k) => <td key={k}>{cell(v, k, i)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
