import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { useUser } from '../auth/Auth';
import { can, completionRate, disciplineOf, isOverdue, OPEN_DEFECT, poolsForUser } from '../lib/rules';
import { updateDefect } from '../lib/actions';
import { Card, DefectBadge, Empty, PageHead, Progress, SeverityBadge, StatusBadge, useFeedback, errMsg } from '../components/ui';
import type { Defect, Inspection } from '../types';
import { Tip } from '../components/Tips';

export default function Tasks() {
  const { t, b } = useI18n();
  const user = useUser();
  const data = useData();
  const { toast } = useFeedback();
  const pools = poolsForUser(user);
  const disc = disciplineOf(user.role);

  const groups = useMemo(() => {
    const has = (i: Inspection, p: string) => i.pools?.includes(p);
    const exec = data.inspections.filter(i => pools.some(p => p.startsWith('exec:') && has(i, p))
      || (user.role === 'supervisor' && i.pools?.some(p => p.startsWith('exec:')) && i.supervisorUid === user.id));
    const approve = data.inspections.filter(i => pools.some(p => p.startsWith('approve:') && has(i, p)));
    const review = data.inspections.filter(i => pools.includes('review') && has(i, 'review') && can.finalApprove(user, i));
    const open = data.defects.filter(OPEN_DEFECT);
    const mine = open.filter(d => d.assignedUid === user.id);
    const pool = open.filter(d => d.pool === disc && d.assignedUid !== user.id && !['repair_completed', 'awaiting_verification'].includes(d.status));
    const verify = open.filter(d => ['repair_completed', 'awaiting_verification'].includes(d.status) && can.verifyDefect(user, d));
    return { exec, approve, review, mine, pool, verify };
  }, [data.inspections, data.defects, pools, disc, user]);

  const claim = async (d: Defect, take: boolean) => {
    try {
      await updateDefect(user, d, take
        ? { assignedUid: user.id, assignedName: user.name, status: d.status === 'open' ? 'assigned' : d.status }
        : { assignedUid: null, assignedName: null, status: d.status === 'assigned' ? 'open' : d.status }, take ? 'claim' : 'release');
    } catch (e) { toast(errMsg(e, t), 'err'); }
  };

  const inspRow = (i: Inspection, what: string) => (
    <Link key={i.id + what} to={`/inspections/${i.id}${what === 'exec' ? '' : '?tab=review'}`} className="lrow">
      <div className="grow">
        <b>{i.equipmentTag}</b> · <span className="mono small">{i.code}</span>
        <div className="meta ellipsis">{b(i.equipmentName)} · {t('insp.wo')}: {i.workOrder}</div>
        {what === 'exec' && disc && (() => {
          const secs = i.checklist.filter(s => s.discipline === disc);
          const done = secs.reduce((a, s) => a + (i.summary.sections[s.id]?.done ?? 0), 0);
          const tot = secs.reduce((a, s) => a + s.items.length, 0);
          return <><Progress value={tot ? (done / tot) * 100 : 0} /><span className="meta">{t('disc.' + disc)}: {done}/{tot}</span></>;
        })()}
        {what === 'exec' && !disc && <Progress value={completionRate(i.summary)} />}
      </div>
      <StatusBadge status={i.status} />
    </Link>
  );
  const defRow = (d: Defect, claimable?: boolean) => (
    <div key={d.id} className={'lrow ' + (isOverdue(d) ? 'tone-border-red' : '')}>
      <Link to={`/defects/${d.id}`} className="grow" style={{ color: 'inherit' }}>
        <b className="mono">{d.code}</b> · {d.equipmentTag}
        <div className="meta ellipsis">{d.description}</div>
        <div className="meta">{t('def.target')}: {d.targetDate}{isOverdue(d) ? ` · ${t('c.overdue')}` : ''}{d.assignedName ? ` · ${d.assignedName}` : ''}</div>
      </Link>
      <div className="stack" style={{ alignItems: 'flex-end', gap: 6 }}>
        <SeverityBadge s={d.severity} /><DefectBadge s={d.status} />
        {claimable && <button className="btn sm outline" onClick={() => claim(d, true)}>{t('tasks.claim')}</button>}
        {d.assignedUid === user.id && <button className="btn sm ghost" onClick={() => claim(d, false)}>{t('tasks.release')}</button>}
      </div>
    </div>
  );

  const sections: [string, JSX.Element[]][] = [
    ['tasks.mine', groups.mine.map(d => defRow(d))],
    ['tasks.exec', groups.exec.map(i => inspRow(i, 'exec'))],
    ['tasks.defects', groups.pool.map(d => defRow(d, true))],
    ['tasks.verify', groups.verify.map(d => defRow(d))],
    ['tasks.approve', groups.approve.map(i => inspRow(i, 'approve'))],
    ['tasks.review', groups.review.map(i => inspRow(i, 'review'))],
  ];
  const total = sections.reduce((a, [, x]) => a + x.length, 0);

  return (
    <>
      <PageHead title={t('tasks.title')} sub={`${t('role.' + user.role)} — ${t('tasks.desc')}`} />
      <Tip id="tasks">{t('tip.tasks')}</Tip>
      {total === 0 ? <Card><Empty icon="check">{t('tasks.none')}</Empty></Card> : (
        <div className="stack">
          {sections.filter(([, x]) => x.length).map(([k, rows]) => (
            <Card key={k} title={<>{t(k)} <span className="badge tone-orange">{rows.length}</span></>}><div className="list">{rows}</div></Card>
          ))}
        </div>
      )}
    </>
  );
}
