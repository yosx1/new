import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDoc } from 'firebase/firestore';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { useUser } from '../auth/Auth';
import { ref, today } from '../lib/db';
import { createInspection } from '../lib/actions';
import { saveAttachment } from '../lib/files';
import { Card, Field, PageHead, useFeedback, errMsg, Badge } from '../components/ui';
import { Tip } from '../components/Tips';
import { Icon } from '../components/Icon';
import type { Discipline, Equipment, Template, TemplateVersion } from '../types';

interface Draft {
  title: string; departmentId: string; equipmentId: string; workOrder: string; maintenanceType: string;
  maintenanceCompletedAt: string; inspectionDate: string; shift: string; supervisorUid: string;
  productionEngUid: string; maintenanceEngUid: string; assignedUids: string[]; remarks: string; templateId: string;
}
const KEY = 'draft:new-inspection';

/** Picks the checklist that fits the equipment and maintenance type (equipment link first, then category). */
export function matchTemplates(templates: Template[], eq: Equipment | undefined, mtype: string) {
  if (!eq) return [];
  const ok = (t: Template) => t.active && (!t.maintenanceTypes.length || t.maintenanceTypes.includes(mtype));
  const linked = templates.filter(t => ok(t) && eq.templateIds?.includes(t.id));
  const byCat = templates.filter(t => ok(t) && t.equipmentCategories.includes(eq.category) && !linked.includes(t));
  return [...linked, ...byCat];
}

export default function NewInspection() {
  const { t, b } = useI18n();
  const user = useUser();
  const data = useData();
  const nav = useNavigate();
  const { toast } = useFeedback();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [version, setVersion] = useState<TemplateVersion | null>(null);
  const restored = useRef(false);
  const [d, setD] = useState<Draft>(() => {
    const blank: Draft = {
      title: '', departmentId: '', equipmentId: '', workOrder: '', maintenanceType: '', maintenanceCompletedAt: today(),
      inspectionDate: today(), shift: '', supervisorUid: user.role === 'supervisor' ? user.id : '', productionEngUid: '',
      maintenanceEngUid: '', assignedUids: [], remarks: '', templateId: '',
    };
    try {
      const s = localStorage.getItem(KEY);
      if (s) {
        const saved = { ...blank, ...JSON.parse(s) } as Draft;
        restored.current = !!(saved.equipmentId || saved.workOrder || saved.remarks);
        return saved;
      }
    } catch { /* ignore */ }
    return blank;
  });

  useEffect(() => { if (restored.current) { restored.current = false; toast(t('insp.draftRestored'), 'info'); } }, []); // eslint-disable-line
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ } }, [d]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(x => ({ ...x, [k]: v }));
  const eq = data.eq(d.equipmentId);
  const candidates = useMemo(() => matchTemplates(data.templates, eq, d.maintenanceType), [data.templates, eq, d.maintenanceType]);
  const tpl = data.templates.find(x => x.id === d.templateId);

  // Auto-select the best checklist whenever equipment or maintenance type changes.
  useEffect(() => {
    if (!candidates.length) { if (d.templateId) set('templateId', ''); return; }
    if (!candidates.some(c => c.id === d.templateId)) set('templateId', candidates[0].id);
  }, [candidates]); // eslint-disable-line

  useEffect(() => {
    setVersion(null);
    if (!tpl) return;
    getDoc(ref(`templates/${tpl.id}/versions`, String(tpl.currentVersion))).then(s => {
      if (s.exists()) setVersion({ id: s.id, ...s.data() } as TemplateVersion);
    });
  }, [tpl?.id, tpl?.currentVersion]); // eslint-disable-line

  const people = (roles: string[]) => data.users.filter(u => u.active && roles.includes(u.role));
  const err = {
    departmentId: !d.departmentId, equipmentId: !d.equipmentId, workOrder: !d.workOrder.trim(), maintenanceType: !d.maintenanceType,
    maintenanceCompletedAt: !d.maintenanceCompletedAt, inspectionDate: !d.inspectionDate || d.inspectionDate < d.maintenanceCompletedAt,
    shift: !d.shift, supervisorUid: !d.supervisorUid,
  };
  const step1Ok = !Object.values(err).some(Boolean);
  const step2Ok = !!tpl && !!version;
  const E = (k: keyof typeof err) => showErrors && err[k] ? t('c.required') : false;

  const next = () => {
    if (step === 1 && !step1Ok) { setShowErrors(true); return; }
    if (step === 2 && !step2Ok) return;
    setStep(s => s + 1); window.scrollTo(0, 0);
  };

  const create = async () => {
    if (!eq || !tpl || !version) return;
    setBusy(true);
    try {
      const sections = version.sections;
      const disciplines = new Set(sections.map(s => s.discipline));
      const required = (tpl.requiredApprovals.length ? tpl.requiredApprovals : [...disciplines]).filter(x => disciplines.has(x)) as Discipline[];
      const { id } = await createInspection(user, {
        title: d.title.trim() || `Cold Run – ${eq.tag} – ${d.workOrder}`,
        plantName: b(data.settings.plantName), departmentId: eq.departmentId, equipmentId: eq.id, equipmentTag: eq.tag,
        equipmentName: eq.name, equipmentCategory: eq.category, workOrder: d.workOrder.trim(), maintenanceType: d.maintenanceType,
        maintenanceCompletedAt: d.maintenanceCompletedAt, inspectionDate: d.inspectionDate, shift: d.shift,
        supervisorUid: d.supervisorUid, productionEngUid: d.productionEngUid || null, maintenanceEngUid: d.maintenanceEngUid || null,
        assignedUids: d.assignedUids, remarks: d.remarks.trim(), templateId: tpl.id, templateCode: tpl.code, templateName: tpl.name,
        templateVersion: version.version, checklist: sections, requiredApprovals: required,
      });
      for (const f of files) {
        await saveAttachment(user, f, { ownerType: 'inspection', ownerId: id, kind: 'file', inspectionId: id }).catch(e => toast(errMsg(e, t), 'err'));
      }
      try { localStorage.removeItem(KEY); } catch { /* ignore */ }
      toast(navigator.onLine ? t('insp.created') : t('c.savedOffline'));
      nav(`/inspections/${id}`, { replace: true });
    } catch (e) { toast(errMsg(e, t), 'err'); }
    finally { setBusy(false); }
  };

  const total = version?.sections.reduce((a, s) => a + s.items.length, 0) ?? 0;

  return (
    <>
      <PageHead title={t('nav.new')} back={() => nav(-1)} />
      <Tip id="newInsp">{t('tip.newInsp')}</Tip>
      <div className="stepper">
        {[t('insp.step1'), t('insp.step2'), t('insp.step3')].map((label, i) => (
          <div key={i} className={'step' + (step === i + 1 ? ' on' : step > i + 1 ? ' done' : '')}>
            <b>{step > i + 1 ? <Icon name="check" size={14} /> : i + 1}</b><span>{label}</span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <div className="grid g2">
            <Field label={t('c.department')} required error={E('departmentId')}>
              <select value={d.departmentId} onChange={e => setD(x => ({ ...x, departmentId: e.target.value, equipmentId: '' }))}>
                <option value="">{t('c.select')}</option>
                {data.departments.filter(x => x.active).map(x => <option key={x.id} value={x.id}>{b(x.name)}</option>)}
              </select>
            </Field>
            <Field label={t('c.equipment')} required error={E('equipmentId')}>
              <select value={d.equipmentId} onChange={e => set('equipmentId', e.target.value)} disabled={!d.departmentId}>
                <option value="">{t('c.select')}</option>
                {data.equipment.filter(x => x.active && x.departmentId === d.departmentId).map(x => <option key={x.id} value={x.id}>{x.tag} – {b(x.name)}</option>)}
              </select>
            </Field>
            {eq && <div className="alert info" style={{ gridColumn: '1 / -1' }}>
              <b className="mono">{eq.tag}</b> · {t('insp.category')}: {eq.category}{eq.line ? ` · ${eq.line}` : ''}{eq.manufacturer ? ` · ${eq.manufacturer} ${eq.model ?? ''}` : ''}
            </div>}
            <Field label={t('insp.wo')} required error={E('workOrder')}><input value={d.workOrder} onChange={e => set('workOrder', e.target.value)} placeholder="WO-…" /></Field>
            <Field label={t('insp.mtype')} required error={E('maintenanceType')}>
              <select value={d.maintenanceType} onChange={e => set('maintenanceType', e.target.value)}>
                <option value="">{t('c.select')}</option>
                {data.settings.maintenanceTypes.map(x => <option key={x}>{x}</option>)}
              </select>
            </Field>
            <Field label={t('insp.mdate')} required error={E('maintenanceCompletedAt')}><input type="date" value={d.maintenanceCompletedAt} onChange={e => set('maintenanceCompletedAt', e.target.value)} /></Field>
            <Field label={t('insp.idate')} required error={E('inspectionDate')}><input type="date" min={d.maintenanceCompletedAt} value={d.inspectionDate} onChange={e => set('inspectionDate', e.target.value)} /></Field>
            <Field label={t('insp.shift')} required error={E('shift')}>
              <select value={d.shift} onChange={e => set('shift', e.target.value)}>
                <option value="">{t('c.select')}</option>
                {data.settings.shifts.map(x => <option key={x}>{x}</option>)}
              </select>
            </Field>
            <Field label={t('insp.supervisor')} required error={E('supervisorUid')}>
              <select value={d.supervisorUid} onChange={e => set('supervisorUid', e.target.value)}>
                <option value="">{t('c.select')}</option>
                {people(['supervisor', 'manager', 'admin']).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
            <Field label={t('insp.prodEng')}>
              <select value={d.productionEngUid} onChange={e => set('productionEngUid', e.target.value)}>
                <option value="">{t('c.unassigned')}</option>
                {people(['production']).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
            <Field label={t('insp.maintEng')}>
              <select value={d.maintenanceEngUid} onChange={e => set('maintenanceEngUid', e.target.value)}>
                <option value="">{t('c.unassigned')}</option>
                {people(['mechanical', 'electrical', 'instrumentation']).map(u => <option key={u.id} value={u.id}>{u.name} · {t('disc.' + u.role)}</option>)}
              </select>
            </Field>
            <Field label={t('insp.titleField')} hint={eq ? `Cold Run – ${eq.tag} – ${d.workOrder || 'WO'}` : undefined}>
              <input value={d.title} onChange={e => set('title', e.target.value)} />
            </Field>
            <Field label={t('insp.plant')}><input value={b(data.settings.plantName)} disabled /></Field>
          </div>
          <Field label={t('insp.assigned')}>
            <div className="chips">
              {people(['mechanical', 'electrical', 'instrumentation', 'production']).map(u => {
                const on = d.assignedUids.includes(u.id);
                return <button type="button" key={u.id} className={'chip' + (on ? ' on' : '')}
                  onClick={() => set('assignedUids', on ? d.assignedUids.filter(x => x !== u.id) : [...d.assignedUids, u.id])}>
                  {on && '✓ '}{u.name} <small className="muted">· {t('disc.' + u.role)}</small></button>;
              })}
            </div>
          </Field>
          <div className="mt"><Field label={t('insp.remarks')}><textarea value={d.remarks} onChange={e => set('remarks', e.target.value)} /></Field></div>
          <div className="mt">
            <Field label={`${t('c.attachments')} (${t('c.optional')})`} hint="PDF / image ≤ 650 KB">
              <input type="file" multiple accept="image/*,application/pdf" onChange={e => setFiles([...(e.target.files ?? [])])} />
            </Field>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card title={t('insp.template')}>
          {!candidates.length ? <p className="alert warn">{t('insp.noTemplate')}</p> : (
            <>
              <p className="alert ok mb"><Icon name="check" size={16} /> {t('insp.autoTemplate')}</p>
              <Field label={t('insp.template')}>
                <select value={d.templateId} onChange={e => set('templateId', e.target.value)}>
                  {candidates.map(x => <option key={x.id} value={x.id}>{x.code} – {b(x.name)} (v{x.currentVersion})</option>)}
                </select>
              </Field>
              {version && (
                <div className="mt stack">
                  {version.sections.map(s => (
                    <div key={s.id} className="lrow">
                      <div className="grow"><b>{b(s.title)}</b><div className="meta">{s.stage} · {t('disc.' + s.discipline)}</div></div>
                      <Badge tone="blue">{s.items.length} {t('insp.items')}</Badge>
                    </div>
                  ))}
                  <p className="muted">{t('c.total')}: {total} {t('insp.items')} · {t('insp.requiredApprovals')}: {tpl!.requiredApprovals.map(x => t('disc.' + x)).join('، ')}</p>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {step === 3 && eq && tpl && (
        <Card title={t('insp.step3')}>
          <dl className="dl">
            <dt>{t('c.equipment')}</dt><dd>{eq.tag} – {b(eq.name)}</dd>
            <dt>{t('c.department')}</dt><dd>{b(data.dept(eq.departmentId)?.name)}</dd>
            <dt>{t('insp.wo')}</dt><dd>{d.workOrder} · {d.maintenanceType}</dd>
            <dt>{t('insp.mdate')}</dt><dd className="ltr">{d.maintenanceCompletedAt}</dd>
            <dt>{t('insp.idate')}</dt><dd className="ltr">{d.inspectionDate} · {d.shift}</dd>
            <dt>{t('insp.supervisor')}</dt><dd>{data.userName(d.supervisorUid)}</dd>
            <dt>{t('insp.template')}</dt><dd>{tpl.code} v{tpl.currentVersion} · {total} {t('insp.items')}</dd>
            <dt>{t('insp.requiredApprovals')}</dt><dd>{tpl.requiredApprovals.map(x => t('disc.' + x)).join('، ')} + {t('disc.final')}</dd>
            {files.length > 0 && <><dt>{t('c.attachments')}</dt><dd>{files.map(f => f.name).join(', ')}</dd></>}
          </dl>
        </Card>
      )}

      <div className="sticky-actions">
        {step > 1 && <button className="btn ghost" onClick={() => setStep(s => s - 1)}>{t('c.previous')}</button>}
        <div className="grow" />
        {step < 3 ? <button className="btn primary" onClick={next} disabled={step === 2 && !step2Ok}>{t('c.next')}</button>
          : <button className="btn success" onClick={create} disabled={busy}><Icon name="check" />{t('insp.create')}</button>}
      </div>
    </>
  );
}
