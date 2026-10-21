import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { onSnapshot } from 'firebase/firestore';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { useUser } from '../auth/Auth';
import { ref } from '../lib/db';
import { approveInspection, deleteInspection, fixPart, rejectInspection, savePart, submitInspection } from '../lib/actions';
import { can } from '../lib/rules';
import { downloadXlsx } from '../lib/xlsx';
import { inspectionFileName, inspectionSheets } from '../lib/inspectionExport';
import { sendCompletionReport } from '../lib/completionReport';
import { Card, Empty, Field, Kpi, Modal, PageHead, PartBadge, Spinner, StatusBadge, errMsg, useFeedback } from '../components/ui';
import { AddFiles, Thumb } from '../components/Attachments';
import { Icon } from '../components/Icon';
import type { Inspection, PartResult } from '../types';

export default function InspectionView() {
  const { id = '' } = useParams();
  const { t, b, lang, fmtDate } = useI18n();
  const user = useUser();
  const data = useData();
  const nav = useNavigate();
  const { toast, confirm } = useFeedback();
  const [insp, setInsp] = useState<Inspection | null | undefined>(undefined);
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => onSnapshot(ref('inspections', id), s => setInsp(s.exists() ? ({ id: s.id, ...s.data() } as Inspection) : null), () => setInsp(null)), [id]);

  if (insp === undefined) return <div className="center-screen"><Spinner /></div>;
  if (insp === null) return <Card><Empty>{t('c.notFound')} <Link to="/inspections">{t('nav.inspections')}</Link></Empty></Card>;

  const s = insp.summary;
  const work = can.work(user, insp);
  const ctx = { lang, deptName: b(data.dept(insp.departmentId)?.name), plantName: b(data.settings.plantName) };
  const run = async (f: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try { await f(); if (ok) toast(navigator.onLine ? ok : t('c.savedOffline')); } catch (e) { toast(errMsg(e, t), 'err'); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!(await confirm(t('insp.delete'), t('insp.deleteDesc', { name: `${insp.title} · ${t('disc.' + insp.discipline)} · ${insp.code}` }), true))) return;
    setBusy(true);
    try { await deleteInspection(user, insp); toast(t('insp.deleted')); nav('/inspections', { replace: true }); }
    catch (e) { toast(errMsg(e, t), 'err'); setBusy(false); }
  };
  const submit = () => run(async () => {
    const next = await submitInspection(user, insp);
    toast(next === 'corrective' ? t('insp.toCorrective') : t('insp.toApproval'));
  });
  const decide = () => {
    if (dialog === 'reject' && comment.trim().length < 3) { toast(t('insp.reasonRequired'), 'err'); return; }
    run(async () => {
      if (dialog === 'approve') {
        await approveInspection(user, insp, comment.trim());
        if (navigator.onLine) {
          sendCompletionReport(user, data.settings, data.users, insp.id, ctx)
            .then(r => toast(r === 'sent' ? t('rep.emailSent') : r === 'failed' ? t('rep.emailFailed') : t('rep.notified'), r === 'failed' ? 'err' : 'ok'))
            .catch(() => {});
        }
      } else await rejectInspection(user, insp, comment.trim());
      setDialog(null); setComment('');
    }, dialog === 'approve' ? undefined : t('insp.sentBackToast'));
  };

  return (
    <>
      <PageHead back={() => nav(-1)} title={insp.title}
        sub={<>{b(data.dept(insp.departmentId)?.name)} · {t('disc.' + insp.discipline)} · <span className="mono">{insp.code}</span> · {insp.shutdownName}</>}
        actions={<>
          <StatusBadge status={insp.status} />
          <button className="btn ghost sm" onClick={() => downloadXlsx(inspectionFileName(insp), inspectionSheets(insp, ctx), lang === 'ar')}><Icon name="download" size={16} />{t('c.exportXlsx')}</button>
          <Link className="btn ghost sm" to={`/print/inspection/${insp.id}`} target="_blank"><Icon name="printer" size={16} />{t('insp.reportPdf')}</Link>
          {can.manageSystem(user) && <button className="btn ghost sm danger-text" disabled={busy} onClick={remove}><Icon name="trash" size={16} />{t('c.delete')}</button>}
        </>} />

      {insp.status === 'pool' && insp.rejection && (
        <p className="alert warn mb"><b>{t('insp.sentBack', { name: insp.rejection.byName })}</b> {insp.rejection.reason}</p>
      )}
      {(insp.status === 'approved' || insp.status === 'archived') && insp.approval && (
        <p className="alert ok mb"><Icon name="check" size={16} /> {t('insp.approvedBy', { name: insp.approval.byName })} · {fmtDate(insp.approval.at, true)}{insp.approval.comment ? ` — ${insp.approval.comment}` : ''}</p>
      )}

      <div className="kpis mb">
        <Kpi label={t('insp.parts')} value={s.total} tone="blue" icon="list" />
        <Kpi label={t('part.ok')} value={s.ok} tone="green" icon="check" />
        <Kpi label={t('part.notok')} value={s.notok} tone="red" icon="x" sub={s.notok ? `${s.fixed} ${t('part.fixed')}` : undefined} />
        <Kpi label={t('part.pending')} value={s.pending} tone="orange" icon="clock" />
      </div>

      {!work && (insp.status === 'pool' || insp.status === 'corrective') && <p className="muted small mb">{t('insp.readonly')}</p>}

      <Card title={`${t('insp.parts')} · ${t('disc.' + insp.discipline)}`}>
        <div className="list">
          {insp.parts.map((p, k) => (
            <PartRow key={p.id} n={k + 1} insp={insp} partId={p.id} name={p.name} r={insp.results[p.id]}
              canCheck={work && insp.status === 'pool'} canFix={work && insp.status === 'corrective'} />
          ))}
        </div>
      </Card>

      <div className="action-bar">
        {insp.status === 'pool' && work && (
          <>
            <span className="small muted grow">{s.pending ? t('insp.submitHint', { n: s.pending }) : s.notok ? t('insp.submitCorrective') : t('insp.submitReady')}</span>
            <button className="btn primary" disabled={busy || s.pending > 0} onClick={submit}><Icon name="check" />{t('insp.submit')}</button>
          </>
        )}
        {insp.status === 'corrective' && <span className="small muted grow">{t('insp.correctiveHint', { n: s.notok - s.fixed })}</span>}
        {insp.status === 'waiting_approval' && (can.approve(user)
          ? <><span className="small muted grow">{t('insp.approveHint')}</span>
            <button className="btn ghost" disabled={busy} onClick={() => setDialog('reject')}>{t('insp.reject')}</button>
            <button className="btn success" disabled={busy} onClick={() => setDialog('approve')}><Icon name="check" />{t('insp.approve')}</button></>
          : <span className="small muted grow">{t('insp.waitingManager')}</span>)}
        {insp.status === 'approved' && can.approve(user) && (
          <><span className="small muted grow">{t('insp.approvedHint')}</span>
            <button className="btn ghost" disabled={busy} onClick={() => setDialog('reject')}>{t('insp.reject')}</button></>
        )}
      </div>

      {dialog && (
        <Modal title={dialog === 'approve' ? t('insp.approve') : t('insp.reject')} onClose={() => setDialog(null)} footer={<>
          <button className="btn ghost" onClick={() => setDialog(null)}>{t('c.cancel')}</button>
          <button className={'btn ' + (dialog === 'approve' ? 'success' : 'danger')} disabled={busy} onClick={decide}>{t('c.confirm')}</button></>}>
          {dialog === 'approve' && <p className="muted">{t('insp.approveDesc')}</p>}
          <Field label={dialog === 'approve' ? t('c.comment') : t('insp.reason')} required={dialog === 'reject'}>
            <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} autoFocus />
          </Field>
          {dialog === 'approve' && <p className="alert safety small"><Icon name="shield" />{t('insp.safety')}</p>}
        </Modal>
      )}
    </>
  );
}

/** One part: OK / Not OK while in the pool; "Mark fixed" during corrective maintenance. */
function PartRow({ n, insp, partId, name, r, canCheck, canFix }: {
  n: number; insp: Inspection; partId: string; name: string; r?: PartResult; canCheck: boolean; canFix: boolean;
}) {
  const { t, fmtDate } = useI18n();
  const user = useUser();
  const { toast, confirm } = useFeedback();
  const [edit, setEdit] = useState<'notok' | 'fix' | null>(null);
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const status = r?.status ?? 'pending';
  const open = (mode: 'notok' | 'fix') => { setEdit(mode); setNote(mode === 'notok' ? r?.note ?? '' : ''); setPhotos(mode === 'notok' ? r?.photoIds ?? [] : []); };
  const save = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); setEdit(null); } catch (e) { toast(errMsg(e, t), 'err'); } finally { setBusy(false); }
  };
  const clear = () => save(() => savePart(user, insp.id, partId, { status: 'pending', note: '', photoIds: [] }));
  // Tapping the active button again un-checks the part (back to "Not checked").
  const ok = () => (status === 'ok' ? clear() : save(() => savePart(user, insp.id, partId, { status: 'ok', note: '', photoIds: [] })));
  const notOk = async () => {
    if (status !== 'notok') { open('notok'); return; }
    if (await confirm(t('insp.uncheck'), t('insp.uncheckDesc', { name }))) clear();
  };
  const confirmEdit = () => {
    if (note.trim().length < 3) { toast(edit === 'fix' ? t('insp.fixRequired') : t('insp.noteRequired'), 'err'); return; }
    save(() => (edit === 'notok'
      ? savePart(user, insp.id, partId, { status: 'notok', note: note.trim(), photoIds: photos })
      : fixPart(user, insp, partId, note.trim(), photos).then(next => next === 'waiting_approval' && toast(t('insp.allFixed')))));
  };

  return (
    <div className={'part-row' + (status === 'notok' && !r?.fix ? ' bad' : '')}>
      <div className="row gap">
        <span className="part-n">{n}</span>
        <div className="grow"><b>{name}</b>
          {r && status !== 'pending' && <div className="meta">{r.byName} · {fmtDate(r.at, true)}</div>}</div>
        {canCheck ? (
          <div className="qbtns">
            <button className={'qbtn pass' + (status === 'ok' ? ' on' : '')} disabled={busy} onClick={ok} aria-label={t('part.ok')} title={status === 'ok' ? t('insp.tapToUncheck') : undefined}><Icon name="check" size={20} /></button>
            <button className={'qbtn fail' + (status === 'notok' ? ' on' : '')} disabled={busy} onClick={notOk} aria-label={t('part.notok')} title={status === 'notok' ? t('insp.tapToUncheck') : undefined}><Icon name="x" size={20} /></button>
          </div>
        ) : <PartBadge status={status} fixed={!!r?.fix} />}
      </div>
      {status === 'notok' && r && edit !== 'notok' && (
        <div className="part-detail">
          <p><b className="tone-text-red">{t('part.notok')}:</b> {r.note}</p>
          {r.photoIds?.length > 0 && <div className="photos">{r.photoIds.map(x => <Thumb key={x} id={x} />)}</div>}
          {r.fix && <p className="mt"><b className="tone-text-purple">{t('part.fixed')}:</b> {r.fix.note} <span className="muted small">— {r.fix.byName} · {fmtDate(r.fix.at, true)}</span></p>}
          {r.fix?.photoIds?.length ? <div className="photos">{r.fix.photoIds.map(x => <Thumb key={x} id={x} />)}</div> : null}
          {canFix && !r.fix && edit !== 'fix' && <button className="btn sm outline mt" onClick={() => open('fix')}><Icon name="check" size={15} />{t('insp.fix')}</button>}
          {canCheck && <button className="btn sm ghost mt" onClick={() => open('notok')}><Icon name="edit" size={15} />{t('c.edit')}</button>}
        </div>
      )}
      {edit && (
        <div className="part-detail stack">
          <Field label={edit === 'notok' ? t('insp.problem') : t('insp.fixNote')} required>
            <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} autoFocus />
          </Field>
          <div className="photos">
            {photos.map(x => <Thumb key={x} id={x} onRemove={() => setPhotos(photos.filter(y => y !== x))} />)}
            <AddFiles label={t('c.photo')} capture meta={{ ownerType: 'result', ownerId: `${insp.id}_${partId}`, kind: edit === 'fix' ? 'after' : 'before', inspectionId: insp.id }}
              onAdded={ids => setPhotos([...photos, ...ids])} />
          </div>
          <div className="row gap">
            <button className="btn ghost sm" onClick={() => setEdit(null)}>{t('c.cancel')}</button>
            <button className={'btn sm ' + (edit === 'notok' ? 'danger' : 'primary')} disabled={busy} onClick={confirmEdit}>{edit === 'notok' ? t('insp.saveNotOk') : t('insp.fix')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
