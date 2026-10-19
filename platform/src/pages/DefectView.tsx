import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { useUser } from '../auth/Auth';
import { col, ref } from '../lib/db';
import { updateDefect } from '../lib/actions';
import { can, isOverdue } from '../lib/rules';
import { Card, DefectBadge, Empty, Field, Modal, PageHead, SeverityBadge, Spinner, errMsg, useFeedback } from '../components/ui';
import { AddFiles, Thumb } from '../components/Attachments';
import { Icon } from '../components/Icon';
import { DEFECT_FLOW, SEVERITIES, type AuditEvent, type Defect, type Severity } from '../types';

type Act = 'assign' | 'repair' | 'verify' | 'reopen' | 'edit';

export default function DefectView() {
  const { id = '' } = useParams();
  const { t, b, fmtDate } = useI18n();
  const user = useUser();
  const data = useData();
  const nav = useNavigate();
  const { toast } = useFeedback();
  const [d, setD] = useState<Defect | null | undefined>(undefined);
  const [act, setAct] = useState<Act | null>(null);
  const [note, setNote] = useState('');
  const [assignee, setAssignee] = useState('');
  const [edit, setEdit] = useState({ severity: 'medium' as Severity, targetDate: '', correctiveAction: '' });
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<AuditEvent[]>([]);

  useEffect(() => onSnapshot(ref('defects', id), s => setD(s.exists() ? ({ id: s.id, ...s.data() } as Defect) : null), () => setD(null)), [id]);
  useEffect(() => {
    if (!can.seeAudit(user)) return;
    return onSnapshot(query(col('audit'), where('entityId', '==', id), orderBy('at', 'desc'), limit(50)),
      s => setLog(s.docs.map(x => ({ id: x.id, ...x.data() }) as AuditEvent)), () => {});
  }, [id, user]);

  if (d === undefined) return <div className="center-screen"><Spinner /></div>;
  if (d === null) return <Card><Empty>{t('c.noResults')}</Empty></Card>;

  const worker = can.workDefect(user, d);
  const lead = can.assignDefect(user);
  const verifier = can.verifyDefect(user, d);
  const step = DEFECT_FLOW.indexOf(d.status);

  const doIt = async (patch: Partial<Defect>, action: string, n = '') => {
    setBusy(true);
    try { await updateDefect(user, d, patch, action, n); toast(navigator.onLine ? t('c.saved') : t('c.savedOffline')); setAct(null); setNote(''); }
    catch (e) { toast(errMsg(e, t), 'err'); } finally { setBusy(false); }
  };
  const now = new Date() as unknown as Defect['reportedAt'];

  const submit = () => {
    if (act === 'assign') {
      const u = data.users.find(x => x.id === assignee);
      return doIt({ assignedUid: u?.id ?? null, assignedName: u?.name ?? null, status: u ? (d.status === 'open' ? 'assigned' : d.status) : 'open' }, 'assign');
    }
    if (act === 'repair') return doIt({ status: 'repair_completed', repair: { by: user.id, byName: user.name, at: now, notes: note.trim() } }, 'repair', note.trim());
    if (act === 'verify') return; // handled by explicit buttons
    if (act === 'reopen') {
      if (note.trim().length < 3) { toast(t('c.required'), 'err'); return; }
      return doIt({ status: 'open', verification: null, closedAt: null, reopenCount: (d.reopenCount ?? 0) + 1 }, 'reopen', note.trim());
    }
    if (act === 'edit') return doIt(edit, 'edit');
  };
  const verify = (pass: boolean) => {
    if (!pass && note.trim().length < 3) { toast(t('c.required'), 'err'); return; }
    return doIt(pass
      ? { status: 'closed', verification: { result: 'pass', by: user.id, byName: user.name, at: now, notes: note.trim() }, closedAt: now }
      : { status: 'in_progress', verification: { result: 'fail', by: user.id, byName: user.name, at: now, notes: note.trim() }, reopenCount: (d.reopenCount ?? 0) + 1 },
    pass ? 'verify.pass' : 'verify.fail', note.trim());
  };

  return (
    <>
      <PageHead back={() => nav(-1)} title={<><span className="mono">{d.code}</span> · {d.equipmentTag}</>}
        sub={<>{b(d.itemLabel)} · <Link to={`/inspections/${d.inspectionId}`}>{d.inspectionCode}</Link></>}
        actions={<><SeverityBadge s={d.severity} /><DefectBadge s={d.status} /></>} />

      <div className="stepper">
        {DEFECT_FLOW.map((s, i) => (
          <div key={s} className={'step' + (i === step ? ' on' : i < step ? ' done' : '')}>
            <b>{i < step ? <Icon name="check" size={14} /> : i + 1}</b><span>{t('ds.' + s)}</span>
          </div>
        ))}
      </div>

      <div className="grid g2">
        <Card title={t('c.details')}>
          <dl className="dl">
            <dt>{t('def.desc')}</dt><dd>{d.description}</dd>
            <dt>{t('c.equipment')}</dt><dd><Link to={`/equipment/${d.equipmentId}`}>{d.equipmentTag}</Link> · {b(data.dept(d.departmentId)?.name)}</dd>
            <dt>{t('c.discipline')}</dt><dd>{t('disc.' + d.pool)}</dd>
            <dt>{t('def.assignee')}</dt><dd>{d.assignedName || t('c.unassigned')}</dd>
            <dt>{t('def.reported')}</dt><dd>{d.reportedByName} · {fmtDate(d.reportedAt, true)}</dd>
            <dt>{t('def.target')}</dt><dd className="ltr" style={{ color: isOverdue(d) ? 'var(--red)' : undefined }}>{d.targetDate}{isOverdue(d) ? ` (${t('c.overdue')})` : ''}</dd>
            <dt>{t('def.ca')}</dt><dd>{d.correctiveAction || '—'}</dd>
            {d.repair && <><dt>{t('ds.repair_completed')}</dt><dd>{d.repair.byName} · {fmtDate(d.repair.at, true)}{d.repair.notes ? ` — ${d.repair.notes}` : ''}</dd></>}
            {d.verification && <><dt>{t('def.verify')}</dt><dd style={{ color: d.verification.result === 'pass' ? 'var(--green)' : 'var(--red)' }}>
              {d.verification.result === 'pass' ? t('item.pass') : t('item.fail')} · {d.verification.byName} · {fmtDate(d.verification.at, true)}{d.verification.notes ? ` — ${d.verification.notes}` : ''}</dd></>}
            {!!d.reopenCount && <><dt>{t('def.reopen')}</dt><dd>{d.reopenCount}×</dd></>}
          </dl>
        </Card>

        <div className="stack">
          <Card title={t('c.actions')}>
            <div className="row gap wrap">
              {d.status !== 'closed' && worker && !d.assignedUid && <button className="btn outline" disabled={busy}
                onClick={() => doIt({ assignedUid: user.id, assignedName: user.name, status: d.status === 'open' ? 'assigned' : d.status }, 'claim')}>{t('tasks.claim')}</button>}
              {d.status !== 'closed' && d.assignedUid === user.id && <button className="btn ghost" disabled={busy}
                onClick={() => doIt({ assignedUid: null, assignedName: null, status: d.status === 'assigned' ? 'open' : d.status }, 'release')}>{t('tasks.release')}</button>}
              {lead && d.status !== 'closed' && <button className="btn ghost" onClick={() => { setAssignee(d.assignedUid ?? ''); setAct('assign'); }}><Icon name="user" size={16} />{t('def.assignee')}</button>}
              {worker && ['open', 'assigned'].includes(d.status) && <button className="btn primary" disabled={busy} onClick={() => doIt({ status: 'in_progress', ...(d.assignedUid ? {} : { assignedUid: user.id, assignedName: user.name }) }, 'start')}>{t('def.start')}</button>}
              {worker && ['in_progress', 'assigned', 'open'].includes(d.status) && <button className="btn success" onClick={() => setAct('repair')}><Icon name="check" size={16} />{t('def.markRepaired')}</button>}
              {worker && d.status === 'repair_completed' && <button className="btn primary" disabled={busy} onClick={() => doIt({ status: 'awaiting_verification' }, 'submit')}>{t('def.requestVerify')}</button>}
              {['repair_completed', 'awaiting_verification'].includes(d.status) && (verifier
                ? <button className="btn success" onClick={() => setAct('verify')}><Icon name="shield" size={16} />{t('def.verify')}</button>
                : lead && <span className="alert warn small">{t('def.cannotVerifyOwn')}</span>)}
              {d.status === 'closed' && can.reopen(user) && <button className="btn ghost" onClick={() => setAct('reopen')}>{t('def.reopen')}</button>}
              {lead && d.status !== 'closed' && <button className="btn ghost" onClick={() => { setEdit({ severity: d.severity, targetDate: d.targetDate, correctiveAction: d.correctiveAction ?? '' }); setAct('edit'); }}><Icon name="edit" size={16} />{t('c.edit')}</button>}
            </div>
          </Card>
          <Card title={t('c.photos')}>
            <div className="photos">
              {(d.photoIds ?? []).map(pid => <Thumb key={pid} id={pid} />)}
              {worker && d.status !== 'closed' && <AddFiles label={t('it.after')} capture meta={{ ownerType: 'defect', ownerId: d.id, kind: 'after', inspectionId: d.inspectionId }}
                onAdded={ids => doIt({ photoIds: [...(d.photoIds ?? []), ...ids] }, 'photo')} />}
            </div>
          </Card>
          {can.seeAudit(user) && log.length > 0 && (
            <Card title={t('c.history')}>
              <div className="list">{log.map(a => (
                <div key={a.id} className="lrow"><div className="grow"><b>{a.userName}</b> <span className="small muted">{a.action}</span>{a.note && <div className="meta">{a.note}</div>}</div>
                  <small className="muted ltr">{fmtDate(a.at, true)}</small></div>
              ))}</div>
            </Card>
          )}
        </div>
      </div>

      {act && (
        <Modal title={act === 'assign' ? t('def.assignee') : act === 'repair' ? t('def.markRepaired') : act === 'verify' ? t('def.verify') : act === 'reopen' ? t('def.reopen') : t('c.edit')}
          onClose={() => setAct(null)} footer={act === 'verify' ? <>
            <button className="btn danger" disabled={busy} onClick={() => verify(false)}>{t('def.verifyFail')}</button>
            <button className="btn success" disabled={busy} onClick={() => verify(true)}>{t('def.verifyPass')}</button>
          </> : <>
            <button className="btn ghost" onClick={() => setAct(null)}>{t('c.cancel')}</button>
            <button className="btn primary" disabled={busy} onClick={submit}>{t('c.save')}</button>
          </>}>
          {act === 'assign' && <Field label={t('def.assignee')}>
            <select value={assignee} onChange={e => setAssignee(e.target.value)}>
              <option value="">{t('c.unassigned')}</option>
              {data.users.filter(u => u.active && u.role === d.pool).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select></Field>}
          {act === 'edit' && <>
            <Field label={t('def.severity')}><select value={edit.severity} onChange={e => setEdit({ ...edit, severity: e.target.value as Severity })}>
              {SEVERITIES.map(s => <option key={s} value={s}>{t('sev.' + s)}</option>)}</select></Field>
            <Field label={t('def.target')}><input type="date" value={edit.targetDate} onChange={e => setEdit({ ...edit, targetDate: e.target.value })} /></Field>
            <Field label={t('def.ca')}><textarea value={edit.correctiveAction} onChange={e => setEdit({ ...edit, correctiveAction: e.target.value })} /></Field>
          </>}
          {(act === 'repair' || act === 'verify' || act === 'reopen') && (
            <Field label={act === 'repair' ? t('def.repairNotes') : t('c.comment')} required={act === 'reopen'}>
              <textarea value={note} onChange={e => setNote(e.target.value)} />
            </Field>
          )}
          {act === 'verify' && <p className="muted small">{t('def.verifyFail')}: {t('c.comment')} {t('c.required')}</p>}
        </Modal>
      )}
    </>
  );
}
