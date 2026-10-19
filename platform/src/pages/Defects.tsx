import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { filterDefects, recurringKeys } from '../lib/filtering';
import { isOverdue, OPEN_DEFECT } from '../lib/rules';
import { downloadText, toCsv } from '../lib/files';
import { Badge, Card, DefectBadge, Empty, PageHead, SeverityBadge, Tabs } from '../components/ui';
import { EMPTY_FILTERS, Filters, type FilterState } from '../components/Filters';
import { Icon } from '../components/Icon';
import { DEFECT_FLOW, DISCIPLINES, type Defect } from '../types';

type View = 'open' | 'critical' | 'overdue' | 'byDisc' | 'all';

export default function Defects() {
  const { t, b, fmtDate } = useI18n();
  const data = useData();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = (params.get('view') as View) || 'open';
  const [f, setF] = useState<FilterState>(EMPTY_FILTERS);
  const recurring = useMemo(() => recurringKeys(data.defects), [data.defects]);

  const rows = useMemo(() => {
    let r = filterDefects(data.defects, f);
    if (view === 'open' || view === 'byDisc') r = r.filter(OPEN_DEFECT);
    if (view === 'critical') r = r.filter(d => OPEN_DEFECT(d) && d.severity === 'critical');
    if (view === 'overdue') r = r.filter(d => isOverdue(d));
    return r;
  }, [data.defects, f, view]);

  const exportCsv = () => downloadText(`defects-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([
    ['Defect ID', 'Inspection', 'Equipment', 'Item', 'Description', 'Severity', 'Discipline', 'Assigned', 'Reported', 'Target', 'Status', 'Corrective action', 'Repaired', 'Verified', 'Closed'],
    ...rows.map(d => [d.code, d.inspectionCode, d.equipmentTag, b(d.itemLabel), d.description, d.severity, d.pool, d.assignedName ?? '',
      fmtDate(d.reportedAt), d.targetDate, d.status, d.correctiveAction ?? '', fmtDate(d.repair?.at ?? null), d.verification ? `${d.verification.result} – ${d.verification.byName}` : '', fmtDate(d.closedAt ?? null)]),
  ]));

  const row = (d: Defect) => (
    <Link key={d.id} to={`/defects/${d.id}`} className={'lrow ' + (isOverdue(d) ? 'tone-border-red' : d.severity === 'critical' && OPEN_DEFECT(d) ? 'tone-border-red' : '')}>
      <div className="grow">
        <b className="mono">{d.code}</b> · <b>{d.equipmentTag}</b> · <span className="muted">{b(d.itemLabel)}</span>
        <div className="meta ellipsis">{d.description}</div>
        <div className="meta">{t('disc.' + d.pool)} · {d.assignedName || t('c.unassigned')} · {t('def.target')}: <span className="ltr">{d.targetDate}</span>
          {isOverdue(d) && <b style={{ color: 'var(--red)' }}> · {t('c.overdue')}</b>}</div>
      </div>
      <div className="stack" style={{ alignItems: 'flex-end', gap: 6 }}>
        <SeverityBadge s={d.severity} /><DefectBadge s={d.status} />
        {recurring.has(d.equipmentId + '|' + d.itemId) && <Badge tone="purple" icon="history">{t('def.recurring')}</Badge>}
      </div>
    </Link>
  );

  return (
    <>
      <PageHead title={t('def.title')} sub={`${rows.length}`} actions={<button className="btn ghost" onClick={exportCsv}><Icon name="download" />{t('c.exportCsv')}</button>} />
      <Tabs<View> value={view} onChange={v => setParams({ view: v })} tabs={[
        ['open', t('def.openOnly')], ['critical', t('def.critical')], ['overdue', t('def.overdue')], ['byDisc', t('def.byDept')], ['all', t('def.all')],
      ]} />
      <Filters value={f} onChange={setF} show={['q', 'dept', 'eq', 'disc', 'status', 'from', 'to']}
        statuses={DEFECT_FLOW.map(s => [s, t('ds.' + s)])} />
      {rows.length === 0 ? <Card><Empty icon="check">{t('c.noResults')}</Empty></Card>
        : view === 'byDisc' ? (
          <div className="stack">
            {DISCIPLINES.map(disc => {
              const list = rows.filter(d => d.pool === disc);
              if (!list.length) return null;
              return <Card key={disc} title={<>{t('disc.' + disc)} <Badge tone="orange">{list.length}</Badge>
                {list.filter(d => d.severity === 'critical').length > 0 && <Badge tone="red">{list.filter(d => d.severity === 'critical').length} {t('sev.critical')}</Badge>}</>}>
                <div className="list">{list.map(row)}</div></Card>;
            })}
          </div>
        ) : <Card><div className="list">{rows.map(row)}</div></Card>}
      <p className="muted small mt" onClick={() => nav('/reports')}>{t('rep.title')} →</p>
    </>
  );
}
