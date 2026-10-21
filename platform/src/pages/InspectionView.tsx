import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { useUser } from '../auth/Auth';
import { col, ref } from '../lib/db';
import {
  approvalBlockers, can, completionRate, missingApprovals, passRate,
} from '../lib/rules';
import { downloadXlsx } from '../lib/xlsx';
import { inspectionFileName, inspectionSheets } from '../lib/inspectionExport';
import { sendCompletionReport } from '../lib/completionReport';
import { approveDiscipline, finalApprove, reopenInspection, saveResult, summaryStale, syncInspection, updateInfo } from '../lib/actions';
import {
  Badge, Card, DefectBadge, Empty, Field, ItemBadge, Kpi, Modal, PageHead, SeverityBadge, Spinner, StatusBadge, Tabs, errMsg, useFeedback,
} from '../components/ui';
import { OwnerFiles } from '../components/Attachments';
import { Icon } from '../components/Icon';
import { ItemSheet } from './ItemSheet';
import type { AuditEvent, ChecklistItemDef, ChecklistSection, Defect, Discipline, Inspection, ItemResult, ItemStatus } from '../types';

type Tab = 'execute' | 'review' | 'info';

export default function InspectionView() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { t, b, lang } = useI18n();
  const user = useUser();
  const data = useData();
  const nav = useNavigate();
  const exportCtx = (i: Inspection) => ({ lang, deptName: b(data.dept(i.departmentId)?.name), plantName: b(data.settings.plantName) });
  const { toast } = useFeedback();
  const [insp, setInsp] = useState<Inspection | null | undefined>(undefined);
  const [results, setResults] = useState<Record<string, ItemResult>>({});
  const [resultsFromServer, setResultsFromServer] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [sheet, setSheet] = useState<{ section: ChecklistSection; item: ChecklistItemDef; status?: ItemStatus } | null>(null);
  const tab = (params.get('tab') as Tab) || 'execute';
  const setTab = (x: Tab) => setParams(p => { p.set('tab', x); return p; }, { replace: true });
  const healed = useRef(false);

  useEffect(() => onSnapshot(ref('inspections', id), s => setInsp(s.exists() ? ({ id: s.id, ...s.data() } as Inspection) : null), () => setInsp(null)), [id]);
  useEffect(() => onSnapshot(col(`inspections/${id}/results`), { includeMetadataChanges: true }, s => {
    setResults(Object.fromEntries(s.docs.map(d => [d.id, { id: d.id, ...d.data() } as ItemResult])));
    setResultsFromServer(!s.metadata.fromCache);
  }), [id]);
  const defects = useMemo(() => data.defects.filter(d => d.inspectionId === id), [data.defects, id]);

  // Self-healing: if two people saved at once, recompute the stored summary from the live results.
  useEffect(() => {
    if (!insp || !resultsFromServer || healed.current || user.role === 'viewer') return;
    if (summaryStale(insp, results, defects)) {
      healed.current = true;
      syncInspection(insp.id, { results, defects }).catch(() => {});
    }
  }, [insp, results, resultsFromServer, defects, user.role]);

  // Open the user's own discipline sections by default.
  useEffect(() => {
    if (!insp || Object.keys(open).length) return;
    const mine = insp.checklist.filter(s => can.executeSection(user, s)
      && ((insp.summary.sections[s.id]?.done ?? 0) < s.items.length || (insp.summary.sections[s.id]?.fail ?? 0) > 0));
    setOpen(Object.fromEntries((mine.length ? mine : insp.checklist.slice(0, 1)).map(s => [s.id, true])));
  }, [insp]); // eslint-disable-line

  if (insp === undefined) return <div className="center-screen"><Spinner /></div>;
  if (insp === null) return <Card><Empty>{t('c.noResults')}</Empty></Card>;

  const s = insp.summary;
  const quick = async (section: ChecklistSection, item: ChecklistItemDef, status: ItemStatus) => {
    const r = results[item.id];
    // Items needing more information open the full sheet instead of saving instantly.
    if (status === 'fail' || (status === 'na' && item.naReasonRequired) || (status === 'pass' && (item.measure || (item.photoRequired && !r?.photoIds?.length)))) {
      setSheet({ section, item, status }); return;
    }
    if (r?.status === status) return;
    try {
      await saveResult(user, insp, {
        id: item.id, sectionId: section.id, discipline: section.discipline, status, value: r?.value ?? null, unit: r?.unit,
        // A re-inspection after a failure starts a fresh comment; the failure text stays on the defect and in the audit trail.
        comment: r?.status === 'fail' ? '' : r?.comment ?? '', naReason: status === 'na' ? r?.naReason ?? '' : '', assignedUid: r?.assignedUid ?? null, defectId: r?.defectId ?? null,
        photoIds: r?.photoIds ?? [], supervisorComment: r?.supervisorComment ?? '',
      }, r?.rev ?? 0);
      syncInspection(insp.id, { results: { ...results, [item.id]: { ...(r ?? {}), id: item.id, status } as ItemResult }, defects, userAction: true }).catch(() => {});
    } catch (e) {
      if ((e as Error).message === 'conflict') { toast(t('it.conflict'), 'err'); setSheet({ section, item }); }
      else toast(errMsg(e, t), 'err');
    }
  };

  return (
    <>
      <PageHead back={() => nav(-1)}
        title={<>{insp.equipmentTag} · <span className="mono">{insp.code}</span></>}
        sub={<>{b(insp.equipmentName)} · {t('insp.wo')} {insp.workOrder} · {b(data.dept(insp.departmentId)?.name)}</>}
        actions={<>
          <StatusBadge status={insp.status} />
          <button className="btn ghost sm" onClick={() => downloadXlsx(inspectionFileName(insp), inspectionSheets(insp, results, defects, exportCtx(insp)), lang === 'ar')}><Icon name="download" size={16} />{t('c.exportXlsx')}</button>
          <Link className="btn ghost sm" to={`/print/inspection/${insp.id}`} target="_blank"><Icon name="printer" size={16} />{t('insp.reportPdf')}</Link>
        </>} />

      <div className="kpis mb">
        <Kpi label={t('insp.completion')} value={`${completionRate(s)}%`} tone="blue" sub={`${s.total - s.pending}/${s.total}`} />
        <Kpi label={t('item.pass')} value={s.pass} tone="green" sub={`${t('insp.passRate')}: ${passRate(s)}%`} />
        <Kpi label={t('item.fail')} value={s.fail} tone="red" sub={s.criticalFail ? `${s.criticalFail} ${t('it.critical')}` : undefined} />
        <Kpi label={t('item.pending')} value={s.pending} tone="orange" sub={s.mandatoryPending ? `${s.mandatoryPending} ${t('it.mandatory')}` : undefined} />
        <Kpi label={t('item.na')} value={s.na} tone="gray" />
        <Kpi label={t('block.openDefects')} value={s.openDefects} tone={s.openCritical ? 'red' : 'purple'} sub={s.openCritical ? `${s.openCritical} ${t('sev.critical')}` : undefined} />
      </div>

      <Tabs<Tab> value={tab} onChange={setTab} tabs={[['execute', t('insp.execute')], ['review', t('insp.review')], ['info', t('insp.info')]]} />

      {tab === 'execute' && (
        <>
          <p className="muted small mb">{t('insp.saveForLater')}</p>
          {insp.checklist.map(sec => {
            const ss = s.sections[sec.id] ?? { done: 0, total: sec.items.length, fail: 0 };
            const mine = can.executeSection(user, sec) && insp.status !== 'approved';
            return (
              <div key={sec.id} className={'sec' + (open[sec.id] ? '' : ' closed')}>
                <button className="sec-head" onClick={() => setOpen(o => ({ ...o, [sec.id]: !o[sec.id] }))}>
                  <Icon name="chevron" className="chev" />
                  <h3>{b(sec.title)} <span className="muted small">· {t('disc.' + sec.discipline)}</span></h3>
                  {!mine && <Icon name="lock" size={15} className="muted" />}
                  <Badge tone={ss.fail ? 'red' : ss.done === ss.total ? 'green' : 'orange'}><span className="ltr">{ss.done}/{ss.total}</span></Badge>
                </button>
                <div className="sec-items">
                  {sec.items.map(item => {
                    const r = results[item.id];
                    const st = r?.status ?? 'pending';
                    const def = defects.find(d => d.id === r?.defectId);
                    return (
                      <div className="item" key={item.id}>
                        <button className="item-main" onClick={() => setSheet({ section: sec, item })}>
                          <div className="lbl">{b(item.label)}</div>
                          <div className="sub">
                            {item.critical && <span className="flag crit">{t('it.critical')}</span>}
                            {!item.mandatory && <span className="muted">{t('c.optional')}</span>}
                            {st !== 'pending' && <ItemBadge status={st} />}
                            {r?.value != null && <span className="ltr">{r.value} {r.unit}</span>}
                            {item.measure && r?.value == null && <span>📏 {item.measure.unit}</span>}
                            {!!r?.photoIds?.length && <span>📷 {r.photoIds.length}</span>}
                            {item.photoRequired && !r?.photoIds?.length && <span>📷 {t('c.required')}</span>}
                            {def && <span className="mono">{def.code} · {t('ds.' + def.status)}</span>}
                            {st === 'fail' && def?.status === 'closed' && <b style={{ color: 'var(--blue)' }}>{t('insp.reinspect')}</b>}
                            {r && <span>{r.inspectorName}</span>}
                          </div>
                        </button>
                        {mine && (
                          <div className="quick">
                            <button className={'qbtn pass' + (st === 'pass' ? ' on' : '')} onClick={() => quick(sec, item, 'pass')} aria-label={t('item.pass')} title={t('item.pass')}><Icon name="check" /></button>
                            <button className={'qbtn fail' + (st === 'fail' ? ' on' : '')} onClick={() => quick(sec, item, 'fail')} aria-label={t('item.fail')} title={t('item.fail')}><Icon name="x" /></button>
                            <button className={'qbtn na' + (st === 'na' ? ' on' : '')} onClick={() => quick(sec, item, 'na')} aria-label={t('item.na')} title={t('item.na')}>N/A</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {defects.length > 0 && (
            <Card title={t('nav.defects')}>
              <div className="list">
                {defects.map(d => (
                  <Link key={d.id} to={`/defects/${d.id}`} className="lrow">
                    <div className="grow"><b className="mono">{d.code}</b> · {b(d.itemLabel)}<div className="meta ellipsis">{d.description}</div></div>
                    <SeverityBadge s={d.severity} /><DefectBadge s={d.status} />
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {tab === 'review' && <Review insp={insp} results={results} defects={defects} />}
      {tab === 'info' && <Info insp={insp} />}

      {sheet && <ItemSheet insp={insp} section={sheet.section} item={sheet.item} result={results[sheet.item.id]} results={results}
        defects={defects} initialStatus={sheet.status} onClose={() => setSheet(null)} />}
    </>
  );
}

function Review({ insp, results, defects }: { insp: Inspection; results: Record<string, ItemResult>; defects: Defect[] }) {
  const { t, b, fmtDate, lang } = useI18n();
  const user = useUser();
  const data = useData();
  const { toast, confirm } = useFeedback();
  const [dialog, setDialog] = useState<{ kind: 'approve' | 'reject' | 'final' | 'override' | 'reopen'; d?: Discipline | 'final' } | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const blockers = approvalBlockers(insp);
  const hard = blockers.filter(x => !x.overridable && x.key !== 'block.approvals');
  const soft = blockers.filter(x => x.overridable);
  const missing = missingApprovals(insp);
  const execDone = insp.summary.pending === 0 && insp.summary.fail === 0 && insp.summary.openDefects === 0;
  const canOverride = can.override(user, data.settings);
  const exportCtx = (i: Inspection) => ({ lang, deptName: b(data.dept(i.departmentId)?.name), plantName: b(data.settings.plantName) });

  const run = async () => {
    if (!dialog) return;
    const needs = dialog.kind === 'reject' || dialog.kind === 'reopen' ? 3 : dialog.kind === 'override' ? 10 : 0;
    if (comment.trim().length < needs) { toast(t('c.required'), 'err'); return; }
    setBusy(true);
    try {
      if (dialog.kind === 'approve') await approveDiscipline(user, insp, dialog.d!, 'approved', comment.trim());
      if (dialog.kind === 'reject') await approveDiscipline(user, insp, dialog.d!, 'rejected', comment.trim());
      if (dialog.kind === 'final') await finalApprove(user, insp, comment.trim());
      if (dialog.kind === 'override') await finalApprove(user, insp, '', comment.trim());
      if ((dialog.kind === 'final' || dialog.kind === 'override') && navigator.onLine) {
        sendCompletionReport(user, data.settings, data.users, insp.id, results, defects, exportCtx(insp))
          .then(r => toast(r === 'sent' ? t('rep.emailSent') : r === 'failed' ? t('rep.emailFailed') : t('rep.notified'), r === 'failed' ? 'err' : 'ok'))
          .catch(() => {});
      }
      if (dialog.kind === 'reopen') await reopenInspection(user, insp, comment.trim());
      toast(navigator.onLine ? t('c.saved') : t('c.savedOffline'));
      setDialog(null); setComment('');
    } catch (e) { toast(errMsg(e, t), 'err'); } finally { setBusy(false); }
  };

  const rows: (Discipline | 'final')[] = [...insp.requiredApprovals, 'final'];
  return (
    <div className="grid g2">
      <Card title={t('insp.requiredApprovals')}>
        <div className="stack">
          {rows.map(d => {
            const a = insp.approvals[d];
            const ok = a?.decision === 'approved';
            const canDo = d === 'final' ? can.finalApprove(user, insp) : can.approveDiscipline(user, d, insp);
            const ready = d === 'final' ? execDone && missing.length === 0 : execDone;
            return (
              <div key={d} className="approval">
                <span className={'ico ' + (ok ? 'tone-green' : a ? 'tone-red' : 'tone-gray')}><Icon name={ok ? 'check' : a ? 'x' : 'clock'} /></span>
                <div className="grow">
                  <b>{t('disc.' + d)}</b>
                  <div className="muted small">{a ? `${ok ? t('insp.approvedBy') : t('insp.rejectedBy')} ${a.byName} · ${fmtDate(a.at, true)}${a.comment ? ' — ' + a.comment : ''}` : t('item.pending')}</div>
                </div>
                {canDo && insp.status !== 'approved' && !ok && (
                  <div className="row gap">
                    {d !== 'final' && <button className="btn sm success" disabled={!ready} onClick={() => setDialog({ kind: 'approve', d })}>{t('insp.approve')}</button>}
                    {d === 'final' && <button className="btn sm success" disabled={!ready || blockers.length > 0} onClick={() => setDialog({ kind: 'final' })}>{t('insp.finalApprove')}</button>}
                    <button className="btn sm ghost" onClick={() => setDialog({ kind: 'reject', d })}>{t('insp.reject')}</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {insp.override && <p className="alert warn mt"><b>{t('insp.override')}:</b> {insp.override.justification} — {insp.override.byName} · {fmtDate(insp.override.at, true)}</p>}
        {insp.status === 'approved' && can.reopen(user) && (
          <button className="btn ghost mt" onClick={() => setDialog({ kind: 'reopen' })}><Icon name="history" />{t('insp.reopen')}</button>
        )}
      </Card>

      <Card title={t('insp.blockers')}>
        {blockers.length === 0 ? <p className="alert ok">{t('insp.noBlockers')}</p> : (
          <div className="stack">
            {blockers.map(x => (
              <div key={x.key} className={'lrow ' + (x.overridable ? 'tone-border-red' : 'tone-border-orange')}>
                <Icon name="alert" /><span className="grow">{t(x.key)}</span><b>{x.n}</b>
              </div>
            ))}
          </div>
        )}
        {soft.length > 0 && hard.length === 0 && missing.length === 0 && canOverride && insp.status !== 'approved' && (
          <div className="mt">
            <p className="small muted">{t('insp.overrideDesc')}</p>
            <button className="btn danger" onClick={async () => { if (await confirm(t('insp.override'), t('insp.overrideDesc'), true)) setDialog({ kind: 'override' }); }}>
              <Icon name="shield" />{t('insp.override')}</button>
          </div>
        )}
      </Card>

      {dialog && (
        <Modal title={dialog.kind === 'override' ? t('insp.override') : dialog.kind === 'reopen' ? t('insp.reopen')
          : `${dialog.kind === 'reject' ? t('insp.reject') : t('insp.approve')} · ${t('disc.' + (dialog.d ?? 'final'))}`}
          onClose={() => setDialog(null)} footer={<>
            <button className="btn ghost" onClick={() => setDialog(null)}>{t('c.cancel')}</button>
            <button className={'btn ' + (dialog.kind === 'reject' || dialog.kind === 'override' ? 'danger' : 'success')} disabled={busy} onClick={run}>{t('c.confirm')}</button>
          </>}>
          {dialog.kind === 'override' && <p className="alert warn">{t('insp.overrideDesc')}</p>}
          <Field label={dialog.kind === 'override' ? t('insp.justification') : t('c.comment')} required={dialog.kind !== 'approve' && dialog.kind !== 'final'}>
            <textarea value={comment} onChange={e => setComment(e.target.value)} />
          </Field>
          {(dialog.kind === 'final' || dialog.kind === 'override') && <p className="alert safety"><Icon name="shield" />{t('insp.safety')}</p>}
        </Modal>
      )}
    </div>
  );
}

function Info({ insp }: { insp: Inspection }) {
  const { t, b, fmtDate } = useI18n();
  const user = useUser();
  const data = useData();
  const { toast } = useFeedback();
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ title: insp.title, workOrder: insp.workOrder, remarks: insp.remarks ?? '', shift: insp.shift, inspectionDate: insp.inspectionDate });
  const [log, setLog] = useState<AuditEvent[]>([]);
  useEffect(() => {
    if (!can.seeAudit(user)) return;
    return onSnapshot(query(col('audit'), where('entityId', '==', insp.id), orderBy('at', 'desc'), limit(100)),
      s => setLog(s.docs.map(d => ({ id: d.id, ...d.data() }) as AuditEvent)), () => {});
  }, [insp.id, user]);
  const isLead = can.createInspection(user);

  return (
    <div className="grid g2">
      <Card title={t('insp.info')} actions={isLead && insp.status !== 'approved' && <button className="btn sm ghost" onClick={() => setEdit(true)}><Icon name="edit" size={15} />{t('c.edit')}</button>}>
        <dl className="dl">
          <dt>{t('insp.titleField')}</dt><dd>{insp.title}</dd>
          <dt>{t('insp.id')}</dt><dd className="mono">{insp.code}</dd>
          <dt>{t('insp.plant')}</dt><dd>{insp.plantName}</dd>
          <dt>{t('c.department')}</dt><dd>{b(data.dept(insp.departmentId)?.name)}</dd>
          <dt>{t('c.equipment')}</dt><dd><Link to={`/equipment/${insp.equipmentId}`}>{insp.equipmentTag} – {b(insp.equipmentName)}</Link></dd>
          <dt>{t('insp.category')}</dt><dd>{insp.equipmentCategory}</dd>
          <dt>{t('insp.wo')}</dt><dd>{insp.workOrder}</dd>
          <dt>{t('insp.mtype')}</dt><dd>{insp.maintenanceType}</dd>
          <dt>{t('insp.mdate')}</dt><dd className="ltr">{insp.maintenanceCompletedAt}</dd>
          <dt>{t('insp.idate')}</dt><dd className="ltr">{insp.inspectionDate}</dd>
          <dt>{t('insp.shift')}</dt><dd>{insp.shift}</dd>
          <dt>{t('insp.supervisor')}</dt><dd>{data.userName(insp.supervisorUid)}</dd>
          <dt>{t('insp.prodEng')}</dt><dd>{data.userName(insp.productionEngUid)}</dd>
          <dt>{t('insp.maintEng')}</dt><dd>{data.userName(insp.maintenanceEngUid)}</dd>
          <dt>{t('insp.assigned')}</dt><dd>{insp.assignedUids.map(u => data.userName(u)).join('، ') || '—'}</dd>
          <dt>{t('insp.template')}</dt><dd>{insp.templateCode} v{insp.templateVersion} – {b(insp.templateName)}</dd>
          <dt>{t('insp.remarks')}</dt><dd>{insp.remarks || '—'}</dd>
          <dt>{t('c.by')}</dt><dd>{insp.createdByName} · {fmtDate(insp.createdAt, true)}</dd>
        </dl>
      </Card>
      <div className="stack">
        <Card title={t('c.attachments')}><OwnerFiles ownerType="inspection" ownerId={insp.id} inspectionId={insp.id} canAdd={user.role !== 'viewer'} /></Card>
        {can.seeAudit(user) && (
          <Card title={t('c.history')}>
            {log.length === 0 ? <Empty /> : <div className="list">{log.map(a => (
              <div key={a.id} className="lrow"><div className="grow"><b>{a.userName}</b> <span className="small muted">{a.action}</span>
                <div className="meta">{a.label} {a.note && `· ${a.note}`} {a.after && a.action === 'result.save' && `→ ${String((a.after as Record<string, unknown>).status)}`}</div></div>
                <small className="muted ltr">{fmtDate(a.at, true)}</small></div>
            ))}</div>}
          </Card>
        )}
      </div>
      {edit && (
        <Modal title={t('c.edit')} onClose={() => setEdit(false)} footer={<>
          <button className="btn ghost" onClick={() => setEdit(false)}>{t('c.cancel')}</button>
          <button className="btn primary" onClick={async () => {
            try { await updateInfo(user, insp, form); toast(t('c.saved')); setEdit(false); } catch (e) { toast(errMsg(e, t), 'err'); }
          }}>{t('c.save')}</button></>}>
          <Field label={t('insp.titleField')}><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label={t('insp.wo')}><input value={form.workOrder} onChange={e => setForm({ ...form, workOrder: e.target.value })} /></Field>
          <Field label={t('insp.idate')}><input type="date" value={form.inspectionDate} onChange={e => setForm({ ...form, inspectionDate: e.target.value })} /></Field>
          <Field label={t('insp.shift')}><select value={form.shift} onChange={e => setForm({ ...form, shift: e.target.value })}>
            {data.settings.shifts.map(x => <option key={x}>{x}</option>)}</select></Field>
          <Field label={t('insp.remarks')}><textarea value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} /></Field>
        </Modal>
      )}
    </div>
  );
}
