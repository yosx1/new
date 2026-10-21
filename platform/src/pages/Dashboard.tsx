import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { useUser } from '../auth/Auth';
import { inMyPool, STATUS_TONE } from '../lib/rules';
import { Card, Empty, Kpi, Progress, Spinner, StatusBadge } from '../components/ui';
import { Donut } from '../components/Charts';
import { ShutdownCard } from '../components/ShutdownCard';
import { TipsCard } from '../components/Tips';
import { Icon } from '../components/Icon';
import { PlantScene } from '../components/PlantScene';
import { DISCIPLINES, type InspectionStatus } from '../types';

const greet = () => { const h = new Date().getHours(); return h < 12 ? 'dash.morning' : h < 17 ? 'dash.afternoon' : 'dash.evening'; };

export default function Dashboard() {
  const { t, b, fmtDate } = useI18n();
  const user = useUser();
  const data = useData();
  const nav = useNavigate();
  const sdId = data.shutdown?.id;
  const current = useMemo(() => data.inspections.filter(i => i.shutdownId === sdId), [data.inspections, sdId]);

  if (!data.loaded) return <div className="center-screen"><Spinner /></div>;

  const by = (s: InspectionStatus) => current.filter(i => i.status === s).length;
  const myPool = data.inspections.filter(i => i.status === 'pool' && inMyPool(user, i)).length;
  const poolAll = by('pool');
  const active = by('corrective') + by('waiting_approval') + by('approved');
  const done = data.archivedCount ?? 0;
  const go = (s: string) => nav('/inspections?status=' + s);
  const segments = (['pool', 'corrective', 'waiting_approval', 'approved'] as InspectionStatus[]).map(s => ({ label: t('st.' + s), value: by(s), tone: STATUS_TONE[s] }));

  return (
    <>
      <section className="page-head dash-hero">
        <PlantScene variant="banner" />
        <div className="grow dash-hero-text">
          <span className="dash-hello">{t(greet(), { name: user.name.split(' ')[0] })}</span>
          <h1>{t('dash.title')}</h1>
          <p>{b(data.settings.plantName)} · <bdi>{fmtDate(new Date())}</bdi>{data.shutdown && <> · <bdi>{data.shutdown.name}</bdi></>}</p>
        </div>
        <div className="row gap wrap dash-hero-actions">
          <button className="btn primary" onClick={() => nav('/inspections/new')}><Icon name="plus" />{t('nav.new')}</button>
        </div>
      </section>
      <TipsCard />
      <ShutdownCard />

      <div className="kpis mt mb">
        <Kpi label={user.role === 'member' ? t('dash.myPool') : t('dash.pool')} value={user.role === 'member' ? myPool : poolAll} tone="blue" icon="tasks" onClick={() => (user.role === 'member' ? nav('/tasks') : go('pool'))} />
        <Kpi label={t('dash.active')} value={active} tone="orange" icon="checklist" onClick={() => nav('/inspections?status=active')} />
        <Kpi label={t('st.corrective')} value={by('corrective')} tone="red" icon="alert" onClick={() => go('corrective')} />
        <Kpi label={t('st.waiting_approval')} value={by('waiting_approval')} tone="purple" icon="shield" onClick={() => go('waiting_approval')} />
        <Kpi label={t('st.approved')} value={by('approved')} tone="green" icon="check" onClick={() => go('approved')} />
        <Kpi label={t('st.archived')} value={done} tone="gray" icon="history" onClick={() => go('archived')} />
      </div>

      <div className="grid g2">
        <Card title={t('dash.byDept')}>
          <div className="bars">
            {data.departments.map(d => {
              const expected = data.equipment.filter(e => e.active && e.departmentId === d.id)
                .reduce((n, e) => n + DISCIPLINES.filter(x => e.parts?.[x]?.length).length, 0);
              const ok = current.filter(i => i.departmentId === d.id && i.status === 'approved').length;
              const pct = expected ? Math.round((ok / expected) * 100) : 0;
              return (
                <div className="bar-row" key={d.id}>
                  <span className="ellipsis">{b(d.name)}</span>
                  <Progress value={pct} tone={pct === 100 ? 'green' : 'blue'} />
                  <span className="val">{expected ? pct + '%' : '—'}</span>
                  <span className="note">{t('dash.deptNote', { a: ok, b: expected })}</span>
                </div>
              );
            })}
          </div>
          <p className="muted small mt">{t('dash.deptHint')}</p>
        </Card>
        <Card title={t('dash.statusMix')}><Donut segments={segments} /></Card>
      </div>

      <Card title={t('dash.latest')} className="mt" actions={<Link to="/inspections" className="btn link sm">{t('c.view')}</Link>}>
        {current.length === 0 ? <Empty>{t('dash.noneYet')}</Empty> : (
          <div className="list">
            {current.slice(0, 8).map(i => (
              <Link key={i.id} to={`/inspections/${i.id}`} className="lrow">
                <div className="grow"><b>{i.title}</b> · <span className="muted">{t('disc.' + i.discipline)}</span>
                  <div className="meta ellipsis">{b(data.dept(i.departmentId)?.name)} · <span className="mono">{i.code}</span> · {i.createdByName}</div></div>
                <StatusBadge status={i.status} />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
