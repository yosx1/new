import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getDocs, limit, orderBy, query, startAfter } from 'firebase/firestore';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { useUser } from '../auth/Auth';
import { can, completionRate, passRate } from '../lib/rules';
import { col } from '../lib/db';
import { filterInspections } from '../lib/filtering';
import { downloadText, toCsv } from '../lib/files';
import { Card, Empty, PageHead, Progress, StatusBadge } from '../components/ui';
import { EMPTY_FILTERS, Filters, type FilterState } from '../components/Filters';
import { Tip } from '../components/Tips';
import { Icon } from '../components/Icon';
import type { Inspection } from '../types';

export default function Inspections() {
  const { t, b, fmtDate } = useI18n();
  const data = useData();
  const user = useUser();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [f, setF] = useState<FilterState>({ ...EMPTY_FILTERS, status: params.get('status') ?? '', q: params.get('q') ?? '' });
  const [older, setOlder] = useState<Inspection[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [noMore, setNoMore] = useState(false);

  const all = useMemo(() => {
    const seen = new Set(data.inspections.map(i => i.id));
    return [...data.inspections, ...older.filter(i => !seen.has(i.id))];
  }, [data.inspections, older]);
  const rows = useMemo(() => filterInspections(all, f, data.defects), [all, f, data.defects]);

  // Older history is paged in on demand to keep daily reads inside the free quota.
  const loadMore = async () => {
    const last = all[all.length - 1];
    if (!last?.createdAt) return;
    setLoadingMore(true);
    try {
      const s = await getDocs(query(col('inspections'), orderBy('createdAt', 'desc'), startAfter(last.createdAt), limit(200)));
      setOlder(o => [...o, ...s.docs.map(d => ({ id: d.id, ...d.data() }) as Inspection)]);
      if (s.size < 200) setNoMore(true);
    } finally { setLoadingMore(false); }
  };

  const exportCsv = () => downloadText(`inspections-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([
    ['ID', 'Title', 'Department', 'Equipment tag', 'Equipment', 'Work order', 'Maintenance type', 'Inspection date', 'Status', 'Total', 'Pass', 'Fail', 'Pending', 'N/A', 'Pass rate %', 'Open defects', 'Created by'],
    ...rows.map(i => [i.code, i.title, b(data.dept(i.departmentId)?.name), i.equipmentTag, b(i.equipmentName), i.workOrder, i.maintenanceType,
      i.inspectionDate, t('st.' + i.status), i.summary.total, i.summary.pass, i.summary.fail, i.summary.pending, i.summary.na, passRate(i.summary), i.summary.openDefects, i.createdByName]),
  ]));

  return (
    <>
      <PageHead title={t('insp.title')} sub={`${rows.length} / ${all.length}`} actions={<>
        <button className="btn ghost" onClick={exportCsv}><Icon name="download" />{t('c.exportCsv')}</button>
        {can.createInspection(user) && <button className="btn primary" onClick={() => nav('/inspections/new')}><Icon name="plus" />{t('nav.new')}</button>}
      </>} />
      <Tip id="inspections">{t('tip.inspections')}</Tip>
      <Filters value={f} onChange={setF} />
      <Card>
        {rows.length === 0 ? <Empty>{t('c.noResults')}</Empty> : (
          <>
            <div className="table-wrap hide-mobile">
              <table className="tbl">
                <thead><tr>
                  <th>{t('insp.id')}</th><th>{t('c.equipment')}</th><th>{t('c.department')}</th><th>{t('insp.wo')}</th>
                  <th>{t('insp.idate')}</th><th>{t('insp.completion')}</th><th>{t('c.status')}</th>
                </tr></thead>
                <tbody>
                  {rows.map(i => (
                    <tr key={i.id} className="click" onClick={() => nav(`/inspections/${i.id}`)}>
                      <td className="mono">{i.code}</td>
                      <td><b>{i.equipmentTag}</b><div className="muted small">{b(i.equipmentName)}</div></td>
                      <td>{b(data.dept(i.departmentId)?.name)}</td>
                      <td>{i.workOrder}<div className="muted small">{i.maintenanceType}</div></td>
                      <td className="ltr">{i.inspectionDate}</td>
                      <td style={{ minWidth: 130 }}><Progress value={completionRate(i.summary)} tone={i.summary.fail ? 'red' : 'green'} />
                        <span className="muted small">{i.summary.total - i.summary.pending}/{i.summary.total}{i.summary.fail ? ` · ${i.summary.fail} ${t('item.fail')}` : ''}</span></td>
                      <td><StatusBadge status={i.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="list hide-desktop">
              {rows.map(i => (
                <Link key={i.id} to={`/inspections/${i.id}`} className="lrow">
                  <div className="grow"><b>{i.equipmentTag}</b> · <span className="mono small">{i.code}</span>
                    <div className="meta ellipsis">{b(i.equipmentName)} · {i.workOrder}</div>
                    <div className="meta">{fmtDate(i.inspectionDate)} · {i.summary.total - i.summary.pending}/{i.summary.total}</div>
                    <Progress value={completionRate(i.summary)} tone={i.summary.fail ? 'red' : 'green'} /></div>
                  <StatusBadge status={i.status} />
                </Link>
              ))}
            </div>
          </>
        )}
        {!noMore && all.length >= 400 && (
          <button className="btn ghost block mt" disabled={loadingMore} onClick={loadMore}><Icon name="history" />{t('c.history')} …</button>
        )}
      </Card>
    </>
  );
}
