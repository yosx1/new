import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { useUser } from '../auth/Auth';
import { col } from '../lib/db';
import { ACTIVE_STATUSES, can, completionRate, departmentReadiness, isOverdue, OPEN_DEFECT, poolsForUser, STATUS_TONE } from '../lib/rules';
import { filterDefects, filterInspections } from '../lib/filtering';
import { Card, DefectBadge, Empty, Kpi, PageHead, Progress, SeverityBadge, Spinner, StatusBadge } from '../components/ui';
import { Donut } from '../components/Charts';
import { EMPTY_FILTERS, Filters, type FilterState } from '../components/Filters';
import { TipsCard } from '../components/Tips';
import { Icon } from '../components/Icon';
import type { AuditEvent, InspectionStatus } from '../types';
import { addDays, today } from '../lib/db';

export default function Dashboard() {
  const { t, b, fmtDate } = useI18n();
  const user = useUser();
  const data = useData();
  const nav = useNavigate();
  const [f, setF] = useState<FilterState>(EMPTY_FILTERS);
  const [activity, setActivity] = useState<AuditEvent[]>([]);

  useEffect(() => {
    if (!can.seeAudit(user)) return;
    return onSnapshot(query(col('audit'), orderBy('at', 'desc'), limit(10)),
      s => setActivity(s.docs.map(d => ({ id: d.id, ...d.data() }) as AuditEvent)), () => {});
  }, [user]);

  const insp = useMemo(() => filterInspections(data.inspections, f), [data.inspections, f]);
  const defs = useMemo(() => filterDefects(data.defects, { ...f, status: '' }), [data.defects, f]);
  const open = defs.filter(OPEN_DEFECT);
  const by = (s: InspectionStatus[]) => insp.filter(i => s.includes(i.status)).length;
  const myPools = poolsForUser(user);
  const mine = data.inspections.filter(i => i.pools?.some(p => myPools.includes(p))).length
    + data.defects.filter(d => OPEN_DEFECT(d) && (d.assignedUid === user.id || (d.pool === user.role && !d.assignedUid))).length;
  const soon = addDays(today(), 3);
  const followUps = open.filter(d => d.targetDate && d.targetDate <= soon).sort((a, b2) => a.targetDate.localeCompare(b2.targetDate));

  if (!data.loaded) return <div className="center-screen"><Spinner /></div>;

  const go = (status?: string) => nav('/inspections' + (status ? `?status=${status}` : ''));
  const statusSegments = (['maintenance_completed', 'in_progress', 'failed_ca', 'awaiting_verification', 'awaiting_dept_approval', 'ready_for_review', 'approved', 'rejected'] as InspectionStatus[])
    .map(s => ({ label: t('st.' + s), value: by([s]), tone: STATUS_TONE[s] }));

  return (
    <>
      <PageHead title={t('dash.title')} sub={`${b(data.settings.plantName)} · ${fmtDate(new Date())}`}
        actions={can.createInspection(user) && <button className="btn primary" onClick={() => nav('/inspections/new')}><Icon name="plus" />{t('nav.new')}</button>} />

      {can.manageSystem(user) && data.departments.length === 0 && (
        <p className="alert info mb">{t('setup.seed')} → <Link to="/settings">{t('nav.settings')}</Link></p>
      )}
      <TipsCard />

      <Filters value={f} onChange={setF} show={['dept', 'eq', 'from', 'to', 'status', 'disc']} />

      <div className="kpis mb">
        <Kpi label={t('dash.myPool')} value={mine} tone="orange" icon="tasks" onClick={() => nav('/tasks')} />
        <Kpi label={t('dash.active')} value={by(ACTIVE_STATUSES)} tone="blue" icon="checklist" onClick={() => go()} />
        <Kpi label={t('dash.awaitingExec')} value={by(['maintenance_completed'])} tone="gray" icon="clock" onClick={() => go('maintenance_completed')} />
        <Kpi label={t('dash.inProgress')} value={by(['in_progress'])} tone="orange" icon="sync" onClick={() => go('in_progress')} />
        <Kpi label={t('dash.awaitingCA')} value={by(['failed_ca', 'awaiting_verification'])} tone="red" icon="alert" onClick={() => go('failed_ca')} />
        <Kpi label={t('dash.awaitingApproval')} value={by(['awaiting_dept_approval', 'ready_for_review'])} tone="purple" icon="shield" onClick={() => go('awaiting_dept_approval')} />
        <Kpi label={t('dash.completed')} value={by(['approved'])} tone="green" icon="check" onClick={() => go('approved')} />
        <Kpi label={t('dash.criticalOpen')} value={open.filter(d => d.severity === 'critical').length} tone="red" icon="alert" onClick={() => nav('/defects?view=critical')} />
        <Kpi label={t('dash.overdueCA')} value={open.filter(d => isOverdue(d)).length} tone="red" icon="clock" onClick={() => nav('/defects?view=overdue')} />
      </div>

      <div className="grid g2">
        <Card title={t('dash.readinessByDept')}>
          <div className="bars">
            {data.departments.filter(d => d.active && (!f.dept || d.id === f.dept)).map(d => {
              const r = departmentReadiness(insp, data.defects, d.id);
              return (
                <div className="bar-row" key={d.id}>
                  <span className="ellipsis">{b(d.name)}</span>
                  <Progress value={r.pct ?? 0} tone={r.blocked ? 'red' : r.pct === 100 ? 'green' : 'blue'} />
                  <span className="val">{r.pct === null ? '—' : r.pct + '%'}</span>
                  <span className="note">{r.total ? `${r.ready}/${r.total} ${t('dash.ready')}` : t('dash.noInspected')}{r.blocked ? ` · ${r.blocked} ${t('dash.blocked')}` : ''}</span>
                </div>
              );
            })}
          </div>
          <p className="muted small mt">{t('dash.readinessNote')}</p>
        </Card>
        <Card title={t('dash.statusMix')}><Donut segments={statusSegments} /></Card>
      </div>

      <div className="grid g2 mt">
        <Card title={t('dash.recentDefects')} actions={<Link to="/defects" className="btn link sm">{t('c.view')}</Link>}>
          {defs.length === 0 ? <Empty icon="check" /> : (
            <div className="list">
              {defs.slice(0, 6).map(d => (
                <Link key={d.id} to={`/defects/${d.id}`} className="lrow">
                  <div className="grow"><b className="mono">{d.code}</b> · <span>{d.equipmentTag}</span>
                    <div className="meta ellipsis">{d.description}</div></div>
                  <SeverityBadge s={d.severity} /><span className="hide-mobile"><DefectBadge s={d.status} /></span>
                </Link>
              ))}
            </div>
          )}
        </Card>
        <Card title={t('dash.followUp')}>
          {followUps.length === 0 ? <Empty icon="check" /> : (
            <div className="list">
              {followUps.slice(0, 6).map(d => (
                <Link key={d.id} to={`/defects/${d.id}`} className={'lrow ' + (isOverdue(d) ? 'tone-border-red' : 'tone-border-orange')}>
                  <div className="grow"><b className="mono">{d.code}</b> · {t('disc.' + d.pool)}
                    <div className="meta">{d.assignedName || t('c.unassigned')}</div></div>
                  <span className={isOverdue(d) ? 'badge tone-red' : 'badge tone-orange'}>{isOverdue(d) ? t('c.overdue') : ''} {d.targetDate}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid g2 mt">
        <Card title={t('nav.inspections')} actions={<Link to="/inspections" className="btn link sm">{t('c.view')}</Link>}>
          {insp.length === 0 ? <Empty /> : (
            <div className="list">
              {insp.slice(0, 6).map(i => (
                <Link key={i.id} to={`/inspections/${i.id}`} className="lrow">
                  <div className="grow"><b>{i.equipmentTag}</b> · <span className="mono">{i.code}</span>
                    <div className="meta ellipsis">{b(i.equipmentName)} · {i.inspectionDate}</div>
                    <Progress value={completionRate(i.summary)} tone={i.summary.fail ? 'red' : 'green'} /></div>
                  <StatusBadge status={i.status} />
                </Link>
              ))}
            </div>
          )}
        </Card>
        {can.seeAudit(user) && (
          <Card title={t('dash.recentActivity')} actions={<Link to="/audit" className="btn link sm">{t('c.view')}</Link>}>
            {activity.length === 0 ? <Empty /> : (
              <div className="list">
                {activity.map(a => (
                  <div key={a.id} className="lrow">
                    <Icon name="history" />
                    <div className="grow"><b>{a.userName}</b> <span className="muted small">{a.action}</span>
                      <div className="meta ellipsis">{a.label} {a.note && `· ${a.note}`}</div></div>
                    <small className="muted ltr">{fmtDate(a.at, true)}</small>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
