import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18n';
import { useUser } from '../auth/Auth';
import { useData } from '../data/DataProvider';
import { saveResult, raiseDefect, syncInspection } from '../lib/actions';
import { addDays, audit, ConflictError, ref, today } from '../lib/db';
import { updateDoc } from 'firebase/firestore';
import { can } from '../lib/rules';
import { Field, ItemBadge, Modal, useFeedback, errMsg, SeverityBadge, DefectBadge } from '../components/ui';
import { AddFiles, Thumb } from '../components/Attachments';
import { Icon } from '../components/Icon';
import { DISCIPLINES, SEVERITIES, type ChecklistItemDef, type ChecklistSection, type Defect, type Discipline, type Inspection, type ItemResult, type ItemStatus, type Severity } from '../types';

interface Props {
  insp: Inspection;
  section: ChecklistSection;
  item: ChecklistItemDef;
  result?: ItemResult;
  results: Record<string, ItemResult>;
  defects: Defect[];
  initialStatus?: ItemStatus;
  onClose: () => void;
}

export function ItemSheet({ insp, section, item, result, results, defects, initialStatus, onClose }: Props) {
  const { t, b, fmtDate } = useI18n();
  const user = useUser();
  const data = useData();
  const { toast } = useFeedback();
  const editable = can.executeSection(user, section) && insp.status !== 'approved';
  const isLead = can.finalApprove(user, insp);

  const [status, setStatus] = useState<ItemStatus>(initialStatus ?? result?.status ?? 'pending');
  const [value, setValue] = useState(result?.value != null ? String(result.value) : '');
  const [comment, setComment] = useState(result?.comment ?? '');
  const [naReason, setNaReason] = useState(result?.naReason ?? '');
  const [photoIds, setPhotoIds] = useState<string[]>(result?.photoIds ?? []);
  const [assignedUid, setAssignedUid] = useState(result?.assignedUid ?? '');
  const [supComment, setSupComment] = useState(result?.supervisorComment ?? '');
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [conflict, setConflict] = useState<ItemResult | null>(null);
  const linked = defects.find(d => d.id === result?.defectId) ?? defects.find(d => d.itemId === item.id && d.status !== 'closed');
  const openLinked = linked && linked.status !== 'closed' ? linked : undefined;

  // Defect form (shown when failing an item without an open defect)
  const [raise, setRaise] = useState(!openLinked);
  const [sev, setSev] = useState<Severity>(item.critical ? 'critical' : 'medium');
  const [pool, setPool] = useState<Discipline>(section.discipline);
  const [target, setTarget] = useState(addDays(today(), data.settings.defectTargetDays[item.critical ? 'critical' : 'medium']));
  const [ca, setCa] = useState('');
  const [defAssignee, setDefAssignee] = useState('');

  const m = item.measure;
  const num = value === '' ? null : Number(value);
  const outOfRange = m && num != null && ((m.min != null && num < m.min) || (m.max != null && num > m.max));
  const ownerId = `${insp.id}_${item.id}`;
  const procDoc = useMemo(() => item.procedureRef, [item.procedureRef]);

  const errors = {
    value: status === 'pass' && !!m && num == null ? t('c.required') : num != null && isNaN(num) ? t('c.error') : '',
    comment: status === 'fail' && !comment.trim() ? t('it.failNeedsComment') : '',
    naReason: status === 'na' && item.naReasonRequired && !naReason.trim() ? t('c.required') : '',
    photo: status === 'pass' && item.photoRequired && !photoIds.length ? t('it.photoRequired') : '',
    ca: status === 'fail' && raise && !openLinked && !ca.trim() ? t('c.required') : '',
  };
  const invalid = Object.values(errors).some(Boolean);

  const save = async (force = false) => {
    setTried(true);
    if (invalid) return;
    setBusy(true);
    try {
      let defectId = result?.defectId ?? linked?.id ?? null;
      if (status === 'fail' && raise && !openLinked) {
        const assignee = data.users.find(u => u.id === defAssignee);
        const d = await raiseDefect(user, data.settings, insp, {
          itemId: item.id, itemLabel: item.label, description: comment.trim(), severity: sev, pool, targetDate: target,
          correctiveAction: ca.trim(), assignedUid: assignee?.id ?? null, assignedName: assignee?.name ?? null, photoIds,
        });
        defectId = d.id;
        toast(`${t('def.raised')}: ${d.code}`, 'info');
      }
      const base = result?.rev ?? 0;
      await saveResult(user, insp, {
        id: item.id, sectionId: section.id, discipline: section.discipline, status,
        value: m ? num : null, unit: m?.unit, comment: comment.trim(), naReason: status === 'na' ? naReason.trim() : '',
        assignedUid: assignedUid || null, defectId, photoIds, supervisorComment: supComment.trim(),
      }, conflict ? conflict.rev : base, force);
      const nextResults = { ...results, [item.id]: { ...(result ?? {}), id: item.id, status } as ItemResult };
      syncInspection(insp.id, { results: nextResults, userAction: true }).catch(e => console.warn('sync', e));
      toast(navigator.onLine ? t('c.saved') : t('c.savedOffline'));
      onClose();
    } catch (e) {
      if (e instanceof ConflictError) setConflict(e.remote as ItemResult);
      else toast(errMsg(e, t), 'err');
    } finally { setBusy(false); }
  };

  const pickStatus = (s: ItemStatus) => { setStatus(s); if (s === 'fail' && !openLinked) setRaise(true); };

  const saveSupervisorComment = async () => {
    if (!result) return;
    setBusy(true);
    try {
      await updateDoc(ref(`inspections/${insp.id}/results`, item.id), { supervisorComment: supComment.trim(), rev: result.rev + 1 });
      audit(user, 'result.supervisorComment', 'inspection', insp.id, { label: `${insp.code} · ${item.id}`, note: supComment.trim() });
      toast(t('c.saved')); onClose();
    } catch (e) { toast(errMsg(e, t), 'err'); } finally { setBusy(false); }
  };

  return (
    <Modal wide title={<>{b(item.label)}<div className="muted small" style={{ fontWeight: 400 }}>{b(section.title)} · {t('disc.' + section.discipline)}</div></>}
      onClose={onClose}
      footer={editable ? <>
        <button className="btn ghost" onClick={onClose}>{t('c.cancel')}</button>
        <button className="btn primary" disabled={busy} onClick={() => save()}><Icon name="check" />{t('c.save')}</button>
      </> : <>
        <button className="btn ghost" onClick={onClose}>{t('c.close')}</button>
        {isLead && result && insp.status !== 'approved' && <button className="btn primary" disabled={busy} onClick={saveSupervisorComment}>{t('c.save')}</button>}
      </>}>

      {!editable && <p className="alert info">{insp.status === 'approved' ? t('st.approved') : t('insp.notYours')}</p>}
      <div className="row gap wrap">
        {item.mandatory && <span className="flag mand">{t('it.mandatory')}</span>}
        {item.critical && <span className="flag crit">{t('it.critical')}</span>}
        <span className="muted small">{item.label.en !== b(item.label) ? item.label.en : item.label.ar}</span>
      </div>
      {item.guidance && b(item.guidance) && <p className="alert info small">{b(item.guidance)}</p>}
      {procDoc && <p className="small"><Icon name="book" size={14} /> {t('it.procedure')}: <Link to={`/documents?q=${encodeURIComponent(procDoc)}`}>{procDoc}</Link></p>}

      {conflict && (
        <div className="alert warn stack">
          <b>{t('it.conflict')}</b>
          <span>{t('it.conflictTheirs')}: <ItemBadge status={conflict.status} /> {conflict.value ?? ''} {conflict.comment} — {conflict.inspectorName} {fmtDate(conflict.at, true)}</span>
          <div className="row gap">
            <button className="btn sm danger" onClick={() => save(true)}>{t('it.keepMine')}</button>
            <button className="btn sm ghost" onClick={onClose}>{t('it.keepTheirs')}</button>
          </div>
        </div>
      )}

      <Field label={t('it.result')}>
        <div className="status-pick">
          {(['pass', 'fail', 'pending', 'na'] as ItemStatus[]).map(s => (
            <button key={s} type="button" disabled={!editable} className={(status === s ? 'on ' : '') + s} onClick={() => pickStatus(s)} aria-pressed={status === s}>
              <Icon name={s === 'pass' ? 'check' : s === 'fail' ? 'x' : s === 'na' ? 'minus' : 'clock'} />{t('item.' + s)}
            </button>
          ))}
        </div>
      </Field>

      {m && (
        <div className="grid g2">
          <Field label={`${t('it.measured')} (${m.unit})`} required={status === 'pass'} error={tried && errors.value}>
            <input type="number" inputMode="decimal" step="any" value={value} disabled={!editable} onChange={e => setValue(e.target.value)} className="ltr" />
          </Field>
          <Field label={t('it.limits')}>
            <input disabled value={m.min == null && m.max == null ? '—' : `${m.min ?? '−∞'} … ${m.max ?? '+∞'} ${m.unit}`} className="ltr" />
          </Field>
          {outOfRange && <p className="alert err" style={{ gridColumn: '1/-1' }}><Icon name="alert" size={16} /> {t('it.outOfRange')}</p>}
        </div>
      )}

      {status === 'na' && (
        <Field label={t('it.naReason')} required={item.naReasonRequired} error={tried && errors.naReason}>
          <input value={naReason} disabled={!editable} onChange={e => setNaReason(e.target.value)} />
        </Field>
      )}

      <Field label={status === 'fail' ? t('it.failNeedsComment') : t('c.comment')} required={status === 'fail'} error={tried && errors.comment}>
        <textarea value={comment} disabled={!editable} onChange={e => setComment(e.target.value)} />
      </Field>

      <Field label={t('c.photos')} error={tried && errors.photo}>
        <div className="photos">
          {photoIds.map((id, i) => <Thumb key={id} id={id} label={i === 0 && result?.status === 'fail' ? t('it.before') : undefined}
            onRemove={editable ? () => setPhotoIds(p => p.filter(x => x !== id)) : undefined} />)}
          {editable && <AddFiles label={t('it.before') + ' / ' + t('it.after')} capture meta={{ ownerType: 'result', ownerId, kind: 'evidence', inspectionId: insp.id }}
            onAdded={ids => setPhotoIds(p => [...p, ...ids])} />}
          {editable && <AddFiles label={t('c.addFile')} accept="application/pdf,image/*" meta={{ ownerType: 'result', ownerId, kind: 'file', inspectionId: insp.id }}
            onAdded={ids => setPhotoIds(p => [...p, ...ids])} />}
        </div>
      </Field>

      <div className="grid g2">
        <Field label={t('it.assignedTo')}>
          <select value={assignedUid} disabled={!editable} onChange={e => setAssignedUid(e.target.value)}>
            <option value="">{t('c.unassigned')}</option>
            {data.users.filter(u => u.active && u.role === section.discipline).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        <Field label={t('it.inspector')}>
          <input disabled value={result ? `${result.inspectorName} · ${fmtDate(result.at, true)}` : user.name} />
        </Field>
      </div>

      {linked && (status !== 'fail' || openLinked) ? (
        <div className="lrow">
          <Icon name="alert" />
          <Link to={`/defects/${linked.id}`} className="grow"><b className="mono">{linked.code}</b> · {linked.description}</Link>
          <SeverityBadge s={linked.severity} /><DefectBadge s={linked.status} />
        </div>
      ) : status === 'fail' && editable && (
        <div className="card" style={{ background: '#fff9f8', borderColor: '#f3c9c6' }}>
          <label className="check mb"><input type="checkbox" checked={raise} onChange={e => setRaise(e.target.checked)} /><b>{t('it.raiseDefect')}</b></label>
          {raise && (
            <div className="grid g2">
              <Field label={t('def.severity')}>
                <select value={sev} onChange={e => { const s = e.target.value as Severity; setSev(s); setTarget(addDays(today(), data.settings.defectTargetDays[s])); }}>
                  {SEVERITIES.map(s => <option key={s} value={s}>{t('sev.' + s)}</option>)}
                </select>
              </Field>
              <Field label={t('c.discipline')}>
                <select value={pool} onChange={e => setPool(e.target.value as Discipline)}>
                  {DISCIPLINES.map(d => <option key={d} value={d}>{t('disc.' + d)}</option>)}
                </select>
              </Field>
              <Field label={t('def.target')}><input type="date" value={target} min={today()} onChange={e => setTarget(e.target.value)} /></Field>
              <Field label={t('def.assignee')}>
                <select value={defAssignee} onChange={e => setDefAssignee(e.target.value)}>
                  <option value="">{t('c.unassigned')}</option>
                  {data.users.filter(u => u.active && u.role === pool).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </Field>
              <div style={{ gridColumn: '1/-1' }}>
                <Field label={t('def.ca')} required error={tried && errors.ca}><textarea value={ca} onChange={e => setCa(e.target.value)} /></Field>
              </div>
            </div>
          )}
        </div>
      )}
      {result?.status === 'fail' && linked?.status === 'closed' && <p className="alert info">{t('insp.reinspect')}</p>}

      {(isLead || result?.supervisorComment) && (
        <Field label={t('it.supervisorComment')}>
          <textarea value={supComment} disabled={!isLead || insp.status === 'approved'} onChange={e => setSupComment(e.target.value)} />
        </Field>
      )}
    </Modal>
  );
}
