import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { filterDefects, filterInspections } from '../lib/filtering';
import { completionRate, departmentReadiness, isOverdue, OPEN_DEFECT, passRate } from '../lib/rules';
import { downloadText, toCsv } from '../lib/files';
import { downloadXlsx } from '../lib/xlsx';
import { Card, Empty, Kpi, PageHead, StatusBadge } from '../components/ui';
import { EMPTY_FILTERS, Filters, type FilterState } from '../components/Filters';
import { Tip } from '../components/Tips';
import { Icon } from '../components/Icon';
import { DISCIPLINES, SEVERITIES, type Defect, type Inspection } from '../types';

const REPORTS = ['plant', 'inspection', 'department', 'equipment', 'openDefects', 'criticalOverdue', 'caCompletion', 'inspCompletion', 'approvalHistory', 'repeated'] as const;
type R = typeof REPORTS[number];
const KEY: Record<R, string> = {
  plant: 'rep.plant', inspection: 'rep.inspection', department: 'rep.department', equipment: 'rep.equipment', openDefects: 'rep.openDefects',
  criticalOverdue: 'rep.criticalOverdue', caCompletion: 'rep.caCompletion', inspCompletion: 'rep.inspCompletion', approvalHistory: 'rep.approvalHistory', repeated: 'rep.repeated',
};
const ms = (x?: { toMillis(): number } | null) => x?.toMillis?.() ?? null;
const hours = (a: number | null, b: number | null) => (a != null && b != null ? (b - a) / 3_600_000 : null);
const avg = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const fmtH = (h: number | null) => (h == null ? '—' : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} d`);

export default function Reports() {
  const { t, b, fmtDate, lang } = useI18n();
  const data = useData();
  const [r, setR] = useState<R>('plant');
  const [f, setF] = useState<FilterState>(EMPTY_FILTERS);
  const insp = useMemo(() => filterInspections(data.inspections, f), [data.inspections, f]);
  const defs = useMemo(() => filterDefects(data.defects, { ...f, status: '' }), [data.defects, f]);

  const resolution = (d: Defect) => hours(ms(d.reportedAt), ms(d.closedAt ?? null));
  const approvalDelay = (i: Inspection) => hours(ms(i.createdAt), ms(i.approvals.final?.at ?? null));

  const report = useMemo((): { cols: string[]; rows: ReactNode[][]; csv: (string | number)[][]; metrics?: [string, ReactNode, string?][] } => {
    const dept = (id: string) => b(data.dept(id)?.name);
    switch (r) {
      case 'plant': {
        const tot = insp.reduce((a, i) => ({ total: a.total + i.summary.total, pass: a.pass + i.summary.pass, fail: a.fail + i.summary.fail, pending: a.pending + i.summary.pending, na: a.na + i.summary.na }), { total: 0, pass: 0, fail: 0, pending: 0, na: 0 });
        const open = defs.filter(OPEN_DEFECT);
        const rows = data.departments.map(d => { const x = departmentReadiness(insp, data.defects, d.id); return [dept(d.id), x.total, x.ready, x.blocked, x.pct == null ? '—' : x.pct + '%'] as (string | number)[]; });
        return {
          metrics: [
            [t('nav.inspections'), insp.length, 'blue'],
            [t('dash.completed'), insp.filter(i => i.status === 'approved').length, 'green'],
            [t('rep.completionRate'), insp.length ? Math.round(insp.filter(i => i.status === 'approved').length / insp.length * 100) + '%' : '—', 'green'],
            [`${t('item.pass')} / ${t('c.total')}`, `${tot.pass} / ${tot.total - tot.na}`, 'green'],
            [t('item.fail'), tot.fail, 'red'], [t('item.pending'), tot.pending, 'orange'], [t('item.na'), tot.na, 'gray'],
            ...SEVERITIES.map(s => [`${t('ds.open')} · ${t('sev.' + s)}`, open.filter(d => d.severity === s).length, s === 'critical' ? 'red' : 'orange'] as [string, ReactNode, string]),
            [t('dash.overdueCA'), open.filter(d => isOverdue(d)).length, 'red'],
            [t('rep.avgResolution'), fmtH(avg(defs.filter(d => d.status === 'closed').map(resolution))), 'purple'],
            [t('rep.approvalDelay'), fmtH(avg(insp.filter(i => i.status === 'approved').map(approvalDelay))), 'purple'],
          ],
          cols: [t('c.department'), t('c.equipment'), t('dash.ready'), t('dash.blocked'), '%'], rows, csv: [['Department', 'Inspected equipment', 'Ready', 'Blocked by critical', 'Readiness %'], ...rows],
        };
      }
      case 'inspection':
        return {
          cols: [t('insp.id'), t('c.equipment'), t('insp.wo'), t('insp.idate'), t('insp.passRate'), t('c.status'), ''],
          rows: insp.map(i => [<span className="mono">{i.code}</span>, i.equipmentTag, i.workOrder, i.inspectionDate, passRate(i.summary) + '%', <StatusBadge status={i.status} />,
            <Link className="btn sm outline" to={`/print/inspection/${i.id}`} target="_blank"><Icon name="printer" size={15} />PDF</Link>]),
          csv: [['ID', 'Equipment', 'WO', 'Date', 'Pass %', 'Status'], ...insp.map(i => [i.code, i.equipmentTag, i.workOrder, i.inspectionDate, passRate(i.summary), i.status])],
        };
      case 'department': {
        const rows = data.departments.map(d => {
          const x = departmentReadiness(insp, data.defects, d.id);
          const di = insp.filter(i => i.departmentId === d.id);
          const od = defs.filter(z => z.departmentId === d.id && OPEN_DEFECT(z));
          return [dept(d.id), di.length, x.total, x.ready, x.blocked, x.pct == null ? '—' : x.pct + '%', od.length, od.filter(z => z.severity === 'critical').length];
        });
        return { cols: [t('c.department'), t('nav.inspections'), t('c.equipment'), t('dash.ready'), t('dash.blocked'), '%', t('block.openDefects'), t('sev.critical')], rows,
          csv: [['Department', 'Inspections', 'Inspected equipment', 'Ready', 'Blocked', 'Readiness %', 'Open defects', 'Critical'], ...rows as (string | number)[][]] };
      }
      case 'equipment': {
        const latest = new Map<string, Inspection>();
        for (const i of insp) if (!latest.has(i.equipmentId)) latest.set(i.equipmentId, i);
        const rows = [...latest.values()].map(i => {
          const od = defs.filter(d => d.equipmentId === i.equipmentId && OPEN_DEFECT(d));
          const crit = od.some(d => d.severity === 'critical');
          return [i.equipmentTag, b(i.equipmentName), dept(i.departmentId), i.code, passRate(i.summary) + '%', t('st.' + i.status), od.length, i.status === 'approved' && !crit ? t('c.yes') : t('c.no')];
        });
        return { cols: [t('insp.tag'), t('c.equipment'), t('c.department'), t('insp.id'), t('insp.passRate'), t('c.status'), t('block.openDefects'), t('dash.ready')], rows,
          csv: [['Tag', 'Equipment', 'Department', 'Latest inspection', 'Pass %', 'Status', 'Open defects', 'Ready'], ...rows as (string | number)[][]] };
      }
      case 'openDefects':
      case 'criticalOverdue': {
        const list = defs.filter(d => OPEN_DEFECT(d) && (r === 'openDefects' || d.severity === 'critical' || isOverdue(d)));
        const rows = list.map(d => [d.code, d.equipmentTag, b(d.itemLabel), t('sev.' + d.severity), t('disc.' + d.pool), d.assignedName ?? '—', d.targetDate + (isOverdue(d) ? ` (${t('c.overdue')})` : ''), t('ds.' + d.status)]);
        return { cols: [t('def.id'), t('c.equipment'), t('it.result'), t('def.severity'), t('c.discipline'), t('def.assignee'), t('def.target'), t('c.status')],
          rows: rows.map((x, k) => [<Link to={`/defects/${list[k].id}`} className="mono">{x[0]}</Link>, ...x.slice(1)]), csv: [['Defect', 'Equipment', 'Item', 'Severity', 'Discipline', 'Assigned', 'Target', 'Status'], ...rows] };
      }
      case 'caCompletion': {
        const rows = DISCIPLINES.map(p => {
          const l = defs.filter(d => d.pool === p);
          const closed = l.filter(d => d.status === 'closed');
          return [t('disc.' + p), l.length, closed.length, l.length - closed.length, l.length ? Math.round(closed.length / l.length * 100) + '%' : '—', l.filter(d => isOverdue(d)).length, fmtH(avg(closed.map(resolution)))];
        });
        return { cols: [t('c.discipline'), t('c.total'), t('ds.closed'), t('ds.open'), t('rep.completionRate'), t('c.overdue'), t('rep.avgResolution')], rows,
          csv: [['Discipline', 'Total', 'Closed', 'Open', 'Completion %', 'Overdue', 'Avg resolution'], ...rows as (string | number)[][]] };
      }
      case 'inspCompletion': {
        const rows = data.departments.map(d => {
          const l = insp.filter(i => i.departmentId === d.id);
          const done = l.filter(i => i.status === 'approved').length;
          return [dept(d.id), l.length, done, l.length - done, l.length ? Math.round(done / l.length * 100) + '%' : '—', l.length ? Math.round(avg(l.map(i => completionRate(i.summary)))!) + '%' : '—'];
        });
        return { cols: [t('c.department'), t('c.total'), t('dash.completed'), t('dash.active'), t('rep.completionRate'), t('insp.completion')], rows,
          csv: [['Department', 'Inspections', 'Approved', 'Active', 'Completion %', 'Avg item completion %'], ...rows as (string | number)[][]] };
      }
      case 'approvalHistory': {
        const rows: (string | number)[][] = [];
        for (const i of insp) for (const [k, a] of Object.entries(i.approvals)) if (a) rows.push([i.code, i.equipmentTag, t('disc.' + k), a.decision === 'approved' ? t('insp.approve') : t('insp.reject'), a.byName, fmtDate(a.at, true), a.comment ?? '']);
        for (const i of insp) if (i.override) rows.push([i.code, i.equipmentTag, t('insp.override'), '⚠', i.override.byName, fmtDate(i.override.at, true), i.override.justification]);
        return { cols: [t('insp.id'), t('c.equipment'), t('c.discipline'), t('c.status'), t('c.by'), t('c.date'), t('c.comment')], rows,
          metrics: [[t('rep.approvalDelay'), fmtH(avg(insp.filter(i => i.status === 'approved').map(approvalDelay))), 'purple']],
          csv: [['Inspection', 'Equipment', 'Discipline', 'Decision', 'By', 'At', 'Comment'], ...rows] };
      }
      case 'repeated': {
        const g = new Map<string, Defect[]>();
        for (const d of defs) g.set(d.equipmentId + '|' + d.itemId, [...(g.get(d.equipmentId + '|' + d.itemId) ?? []), d]);
        const rows = [...g.values()].filter(x => x.length > 1).sort((a, c) => c.length - a.length)
          .map(x => [x[0].equipmentTag, b(x[0].itemLabel), x.length, x.filter(OPEN_DEFECT).length, x.map(d => d.code).join(' ')]);
        return { cols: [t('c.equipment'), t('it.result'), t('rep.count'), t('ds.open'), t('def.id')], rows, csv: [['Equipment', 'Item', 'Occurrences', 'Open', 'Defects'], ...rows] };
      }
    }
  }, [r, insp, defs, data, t, b, fmtDate]);

  // Excel: the report on screen, with the filters that produced it written above the table.
  const exportXlsx = () => {
    const filters = [
      f.dept && `${t('c.department')}: ${b(data.dept(f.dept)?.name)}`,
      f.eq && `${t('c.equipment')}: ${data.equipment.find(e => e.id === f.eq)?.tag ?? f.eq}`,
      f.disc && `${t('c.discipline')}: ${t('disc.' + f.disc)}`,
      f.from && `${t('c.from')}: ${f.from}`,
      f.to && `${t('c.to')}: ${f.to}`,
    ].filter(Boolean).join(' · ');
    const header = report.cols.length === report.csv[0]?.length ? report.cols : report.csv[0].map(String);
    downloadXlsx(`${t(KEY[r])} ${new Date().toISOString().slice(0, 10)}.xlsx`, [{
      name: t(KEY[r]),
      title: [t(KEY[r]), `${b(data.settings.plantName)} · ${t('rep.generated')} ${fmtDate(new Date(), true)}`, `${t('c.filters')}: ${filters || t('c.all')}`,
        ...(report.metrics ?? []).map(([k, v]) => `${k}: ${typeof v === 'string' || typeof v === 'number' ? v : ''}`)],
      header, rows: report.csv.slice(1),
    }], lang === 'ar');
  };

  return (
    <>
      <PageHead title={t('rep.title')} actions={<>
        <button className="btn primary" onClick={exportXlsx}><Icon name="download" />{t('c.exportXlsx')}</button>
        <button className="btn ghost" onClick={() => downloadText(`${r}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(report.csv))}><Icon name="download" />{t('c.exportCsv')}</button>
        <button className="btn ghost" onClick={() => window.print()}><Icon name="printer" />{t('c.print')}</button>
      </>} />
      <Tip id="reports">{t('tip.reports')}</Tip>
      <div className="no-print">
        <Field2 label={t('rep.choose')}>
          <div className="chips mb">{REPORTS.map(x => <button key={x} className={'chip' + (r === x ? ' on' : '')} onClick={() => setR(x)}>{t(KEY[x])}</button>)}</div>
        </Field2>
        <Filters value={f} onChange={setF} show={['dept', 'eq', 'from', 'to', 'disc']} />
      </div>
      <h2 className="mb">{t(KEY[r])} <small className="muted small">· {b(data.settings.plantName)} · {t('rep.generated')} {fmtDate(new Date(), true)}</small></h2>
      {report.metrics && <div className="kpis mb">{report.metrics.map(([l, v, tone]) => <Kpi key={l} label={l} value={v} tone={tone} />)}</div>}
      <Card>
        {report.rows.length === 0 ? <Empty>{t('c.noResults')}</Empty> : (
          <div className="table-wrap"><table className="tbl">
            <thead><tr>{report.cols.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
            <tbody>{report.rows.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
          </table></div>
        )}
      </Card>
    </>
  );
}

function Field2({ label, children }: { label: string; children: ReactNode }) {
  return <div><div className="field-label mb" style={{ marginBottom: 6 }}>{label}</div>{children}</div>;
}
