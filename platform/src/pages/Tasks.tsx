import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { useUser } from '../auth/Auth';
import { createInspection } from '../lib/actions';
import { can, equipmentTitle, inMyPool, inspectionId, matchesEquipment } from '../lib/rules';
import { Card, Empty, PageHead, errMsg, useFeedback } from '../components/ui';
import { InspectionRow } from '../components/InspectionRow';
import { Tip } from '../components/Tips';
import { Icon } from '../components/Icon';

/** "Waiting in your pool": everything the person's team (discipline + department) still has to do. */
export default function Tasks() {
  const { t, b } = useI18n();
  const user = useUser();
  const data = useData();
  const nav = useNavigate();
  const { toast } = useFeedback();
  const [busy, setBusy] = useState('');
  const [q, setQ] = useState('');
  const sd = data.shutdown;

  const g = useMemo(() => {
    const cur = data.inspections.filter(i => i.shutdownId === sd?.id);
    const lead = user.role !== 'member';
    const ids = new Set(cur.map(i => i.id));
    return {
      pool: cur.filter(i => i.status === 'pool' && (lead || inMyPool(user, i))),
      corrective: cur.filter(i => i.status === 'corrective' && (lead || inMyPool(user, i))),
      approve: lead ? cur.filter(i => i.status === 'waiting_approval') : [],
      // Equipment of my team with no inspection yet in this shutdown.
      notStarted: !sd || lead ? [] : data.equipment.filter(e => e.active).flatMap(e => can.disciplinesFor(user, e)
        .filter(d => !ids.has(inspectionId(sd.id, e.id, d))).map(d => ({ e, d }))),
    };
  }, [data.inspections, data.equipment, sd, user]);

  const start = async (eId: string, d: typeof g.notStarted[number]['d']) => {
    const e = data.eq(eId); if (!e || !sd) return;
    setBusy(eId + d);
    try { nav(`/inspections/${await createInspection(user, sd, e, d)}`); } catch (err) { toast(errMsg(err, t), 'err'); } finally { setBusy(''); }
  };
  const team = user.role === 'member' ? `${t('disc.' + user.discipline)} · ${user.departmentId ? b(data.dept(user.departmentId)?.name) : t('usr.allDepts')}` : t('role.' + user.role);
  const total = g.pool.length + g.corrective.length + g.approve.length + g.notStarted.length;

  return (
    <>
      <PageHead title={t('tasks.title')} sub={team} />
      <Tip id="tasks">{t('tip.tasks')}</Tip>
      {total === 0 ? <Card><Empty icon="check">{t('tasks.none')}</Empty></Card> : (
        <div className="stack">
          {g.pool.length > 0 && <Card title={<>{t('tasks.pool')} <span className="badge tone-blue">{g.pool.length}</span></>}><div className="list">{g.pool.map(i => <InspectionRow key={i.id} i={i} />)}</div></Card>}
          {g.corrective.length > 0 && <Card title={<>{t('st.corrective')} <span className="badge tone-red">{g.corrective.length}</span></>}><div className="list">{g.corrective.map(i => <InspectionRow key={i.id} i={i} />)}</div></Card>}
          {g.approve.length > 0 && <Card title={<>{t('st.waiting_approval')} <span className="badge tone-purple">{g.approve.length}</span></>}><div className="list">{g.approve.map(i => <InspectionRow key={i.id} i={i} />)}</div></Card>}
          {g.notStarted.length > 0 && (
            <Card title={<>{t('tasks.notStarted')} <span className="badge tone-gray">{g.notStarted.length}</span></>}>
              {g.notStarted.length > 10 && (
                <div className="search mb"><Icon name="search" size={18} />
                  <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('eq.searchHint')} aria-label={t('eq.searchHint')} /></div>
              )}
              <div className="list">{g.notStarted.filter(({ e }) => matchesEquipment(e, q)).slice(0, 200).map(({ e, d }) => (
                <div key={e.id + d} className="lrow">
                  <div className="grow">{e.code && <span className="mono eq-code">{e.code}</span>} <b>{e.name}</b> · <span className="muted">{t('disc.' + d)}</span>
                    <div className="meta">{b(data.dept(e.departmentId)?.name)} · {e.parts[d].length} {t('eq.parts')}</div></div>
                  <Link className="btn sm ghost" to={`/inspections/new?eq=${encodeURIComponent(e.id)}&d=${d}`} title={t('tasks.adjust')} aria-label={`${t('tasks.adjust')}: ${equipmentTitle(e)}`}><Icon name="edit" size={15} /></Link>
                  <button className="btn sm primary" disabled={busy === e.id + d} onClick={() => start(e.id, d)}><Icon name="plus" size={15} />{t('tasks.start')}</button>
                </div>
              ))}</div>
              {g.notStarted.filter(({ e }) => matchesEquipment(e, q)).length > 200 && <p className="muted small mt">{t('tasks.more')}</p>}
            </Card>
          )}
        </div>
      )}
    </>
  );
}
