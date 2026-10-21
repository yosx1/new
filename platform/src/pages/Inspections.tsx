import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { downloadXlsx } from '../lib/xlsx';
import { Card, Empty, PageHead, Tabs } from '../components/ui';
import { EMPTY_FILTERS, Filters, applyFilters, type FilterState } from '../components/Filters';
import { InspectionRow } from '../components/InspectionRow';
import { ShutdownCard } from '../components/ShutdownCard';
import { Tip } from '../components/Tips';
import { Icon } from '../components/Icon';
import type { InspectionStatus } from '../types';

type Tab = 'pool' | 'active' | 'archived';
type Sub = '' | 'corrective' | 'waiting_approval' | 'approved';

/** New → Waiting in your pool → Active (Corrective maintenance, Waiting approval, Approved) → Done. */
export default function Inspections() {
  const { t, b, lang, fmtDate } = useI18n();
  const data = useData();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const st = params.get('status') ?? 'pool';
  const tab: Tab = st === 'archived' ? 'archived' : st === 'pool' ? 'pool' : 'active';
  const sub: Sub = (['corrective', 'waiting_approval', 'approved'] as string[]).includes(st) ? (st as Sub) : '';
  const setStatus = (s: string) => setParams(p => { p.set('status', s); return p; }, { replace: true });
  const [f, setF] = useState<FilterState>(EMPTY_FILTERS);

  const sdId = data.shutdown?.id;
  const base = useMemo(() => data.inspections.filter(i => (tab === 'archived' ? i.status === 'archived' : i.shutdownId === sdId)), [data.inspections, tab, sdId]);
  const filtered = applyFilters(base, f);
  const count = (s: InspectionStatus[]) => base.filter(i => s.includes(i.status)).length;
  const rows = filtered.filter(i => tab === 'pool' ? i.status === 'pool' : tab === 'archived' ? true
    : sub ? i.status === sub : ['corrective', 'waiting_approval', 'approved'].includes(i.status));

  const exportXlsx = () => downloadXlsx(`${t('nav.inspections')} ${new Date().toISOString().slice(0, 10)}.xlsx`, [{
    name: t('nav.inspections'),
    title: [t('nav.inspections'), `${b(data.settings.plantName)} · ${t('rep.generated')} ${fmtDate(new Date(), true)}`],
    header: [t('insp.id'), t('c.equipment'), t('c.department'), t('c.discipline'), t('c.status'), t('insp.parts'), t('part.ok'), t('part.notok'), t('part.fixed'), t('part.pending'), t('insp.by'), t('sd.title')],
    rows: rows.map(i => [i.code, i.title, b(data.dept(i.departmentId)?.name), t('disc.' + i.discipline), t('st.' + i.status), i.summary.total, i.summary.ok, i.summary.notok, i.summary.fixed, i.summary.pending, i.createdByName, i.shutdownName]),
  }], lang === 'ar');

  return (
    <>
      <PageHead title={t('insp.title')} sub={data.shutdown?.name} actions={<>
        <button className="btn ghost" onClick={exportXlsx} disabled={!rows.length}><Icon name="download" />{t('c.exportXlsx')}</button>
        <button className="btn primary" onClick={() => nav('/inspections/new')}><Icon name="plus" />{t('nav.new')}</button>
      </>} />
      <Tip id="inspections">{t('tip.inspections')}</Tip>
      {tab !== 'archived' && <ShutdownCard />}
      <div className="mt">
        <Tabs<Tab> value={tab} onChange={x => setStatus(x)} tabs={[
          ['pool', <>{t('st.pool')} <b className="tab-n">{count(['pool'])}</b></>],
          ['active', <>{t('dash.active')} <b className="tab-n">{count(['corrective', 'waiting_approval', 'approved'])}</b></>],
          ['archived', <>{t('st.archived')} <b className="tab-n">{data.inspections.filter(i => i.status === 'archived').length}</b></>],
        ]} />
      </div>
      {tab === 'active' && (
        <div className="chips mb">
          {([['', t('c.all')], ['corrective', t('st.corrective')], ['waiting_approval', t('st.waiting_approval')], ['approved', t('st.approved')]] as [Sub, string][]).map(([k, l]) => (
            <button key={k} className={'chip' + (sub === k ? ' on' : '')} onClick={() => setStatus(k || 'active')}>
              {l} <b>{k ? count([k as InspectionStatus]) : count(['corrective', 'waiting_approval', 'approved'])}</b></button>
          ))}
        </div>
      )}
      <Filters value={f} onChange={setF} show={tab === 'archived' ? ['q', 'shutdown', 'dept', 'disc'] : ['q', 'dept', 'eq', 'disc']} />
      <Card>
        {rows.length === 0 ? <Empty>{tab === 'pool' ? t('insp.emptyPool') : tab === 'archived' ? t('insp.emptyDone') : t('insp.emptyActive')}</Empty> : (
          <div className="list">{rows.map(i => <InspectionRow key={i.id} i={i} />)}</div>
        )}
      </Card>
    </>
  );
}
