import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, getDocs, orderBy, query, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { useUser } from '../auth/Auth';
import { audit, col, ref } from '../lib/db';
import { Badge, Card, Field, Modal, PageHead, Spinner, errMsg, useFeedback } from '../components/ui';
import { Icon } from '../components/Icon';
import { DISCIPLINES, type ChecklistItemDef, type ChecklistSection, type Discipline, type Template, type TemplateVersion } from '../types';

const rid = () => Math.random().toString(36).slice(2, 9);
const newItem = (): ChecklistItemDef => ({ id: rid(), label: { en: '', ar: '' }, mandatory: true, critical: false, measure: null });
const newSection = (): ChecklistSection => ({ id: rid(), title: { en: '', ar: '' }, discipline: 'mechanical', stage: 'Inspection', items: [newItem()] });

export default function TemplateEditor() {
  const { id = 'new' } = useParams();
  const isNew = id === 'new';
  const { t, b, fmtDate } = useI18n();
  const user = useUser();
  const data = useData();
  const nav = useNavigate();
  const { toast } = useFeedback();
  const [meta, setMeta] = useState<Omit<Template, 'id'> | null>(null);
  const [sections, setSections] = useState<ChecklistSection[]>([]);
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [publish, setPublish] = useState(false);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) {
      setMeta({ code: '', name: { en: '', ar: '' }, equipmentCategories: [], maintenanceTypes: [], requiredApprovals: ['mechanical', 'electrical', 'production'], currentVersion: 0, active: true });
      setSections([newSection()]);
      return;
    }
    (async () => {
      const s = await getDoc(ref('templates', id));
      if (!s.exists()) { nav('/templates'); return; }
      const m = s.data() as Template;
      setMeta(m);
      const v = await getDoc(ref(`templates/${id}/versions`, String(m.currentVersion)));
      setSections(v.exists() ? (v.data() as TemplateVersion).sections : []);
      const all = await getDocs(query(col(`templates/${id}/versions`), orderBy('version', 'desc')));
      setVersions(all.docs.map(d => ({ id: d.id, ...d.data() }) as TemplateVersion));
    })().catch(e => toast(errMsg(e, t), 'err'));
  }, [id]); // eslint-disable-line

  if (!meta) return <div className="center-screen"><Spinner /></div>;

  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  const updSec = (i: number, p: Partial<ChecklistSection>) => setSections(s => s.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const updItem = (si: number, ii: number, p: Partial<ChecklistItemDef>) =>
    setSections(s => s.map((x, k) => (k === si ? { ...x, items: x.items.map((y, j) => (j === ii ? { ...y, ...p } : y)) } : x)));
  const move = <T,>(arr: T[], i: number, d: number) => { const a = [...arr]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; };

  const problems = [
    !meta.code.trim() && t('c.code'),
    !(meta.name.en || meta.name.ar) && t('c.name'),
    !sections.length && t('tpl.sections'),
    sections.some(s => !(s.title.en || s.title.ar) || !s.items.length) && t('tpl.sections'),
    sections.some(s => s.items.some(i => !(i.label.en || i.label.ar))) && t('tpl.addItem'),
  ].filter(Boolean);

  const doPublish = async () => {
    if (problems.length) { toast(`${t('c.required')}: ${problems.join(', ')}`, 'err'); return; }
    setBusy(true);
    try {
      const code = meta.code.trim().toUpperCase();
      const tid = isNew ? code : id;
      if (isNew && data.templates.some(x => x.id === tid)) { toast(t('eq.tagExists'), 'err'); setBusy(false); return; }
      const version = (meta.currentVersion ?? 0) + 1;
      const b2 = writeBatch(db);
      b2.set(doc(db, 'templates', tid, 'versions', String(version)), {
        version, sections, notes: notes.trim(), createdAt: serverTimestamp(), createdBy: user.id, createdByName: user.name,
      });
      b2.set(doc(db, 'templates', tid), { ...meta, code, currentVersion: version, updatedAt: serverTimestamp(), updatedBy: user.id });
      await b2.commit();
      audit(user, 'template.publish', 'template', tid, { label: `${code} v${version}`, note: notes.trim() });
      toast(t('tpl.published'));
      setPublish(false);
      nav('/templates');
    } catch (e) { toast(errMsg(e, t), 'err'); } finally { setBusy(false); }
  };

  const saveMetaOnly = async () => {
    if (isNew) return;
    try {
      const b2 = writeBatch(db);
      b2.update(doc(db, 'templates', id), { name: meta.name, equipmentCategories: meta.equipmentCategories, maintenanceTypes: meta.maintenanceTypes,
        requiredApprovals: meta.requiredApprovals, active: meta.active, updatedAt: serverTimestamp(), updatedBy: user.id });
      await b2.commit();
      audit(user, 'template.edit', 'template', id, { label: meta.code });
      toast(t('c.saved'));
    } catch (e) { toast(errMsg(e, t), 'err'); }
  };

  return (
    <>
      <PageHead back={() => nav('/templates')} title={isNew ? t('tpl.add') : <><span className="mono">{meta.code}</span> · {b(meta.name)}</>}
        sub={!isNew && <>{t('c.version')} {meta.currentVersion}</>}
        actions={<>
          {!isNew && <button className="btn ghost" onClick={saveMetaOnly}>{t('c.save')}</button>}
          <button className="btn primary" onClick={() => setPublish(true)}><Icon name="check" />{t('tpl.publish')}</button>
        </>} />
      <p className="alert warn mb">{t('tpl.exampleWarn')}</p>

      <Card>
        <div className="grid g3">
          <Field label={t('c.code')} required><input value={meta.code} disabled={!isNew} onChange={e => setMeta({ ...meta, code: e.target.value })} className="ltr" /></Field>
          <Field label={t('c.nameEn')} required><input dir="ltr" value={meta.name.en} onChange={e => setMeta({ ...meta, name: { ...meta.name, en: e.target.value } })} /></Field>
          <Field label={t('c.nameAr')} required><input dir="rtl" value={meta.name.ar} onChange={e => setMeta({ ...meta, name: { ...meta.name, ar: e.target.value } })} /></Field>
        </div>
        <div className="stack mt">
          <Field label={t('tpl.categories')}><div className="chips">{data.settings.equipmentCategories.map(c =>
            <button type="button" key={c} className={'chip' + (meta.equipmentCategories.includes(c) ? ' on' : '')} onClick={() => setMeta({ ...meta, equipmentCategories: toggle(meta.equipmentCategories, c) })}>{c}</button>)}</div></Field>
          <Field label={t('tpl.mtypes')} hint={`${t('c.none')} = ${t('c.all')}`}><div className="chips">{data.settings.maintenanceTypes.map(c =>
            <button type="button" key={c} className={'chip' + (meta.maintenanceTypes.includes(c) ? ' on' : '')} onClick={() => setMeta({ ...meta, maintenanceTypes: toggle(meta.maintenanceTypes, c) })}>{c}</button>)}</div></Field>
          <Field label={t('tpl.approvals')}><div className="chips">{DISCIPLINES.map(d =>
            <button type="button" key={d} className={'chip' + (meta.requiredApprovals.includes(d) ? ' on' : '')} onClick={() => setMeta({ ...meta, requiredApprovals: toggle(meta.requiredApprovals, d) })}>{t('disc.' + d)}</button>)}</div></Field>
          <label className="check"><input type="checkbox" checked={meta.active} onChange={e => setMeta({ ...meta, active: e.target.checked })} />{t('c.active')}</label>
        </div>
      </Card>

      <h2 className="mt mb">{t('tpl.sections')}</h2>
      {sections.map((s, si) => (
        <Card key={s.id} className="mb" title={<>{si + 1}. {b(s.title) || '…'} <Badge tone="blue">{s.items.length}</Badge></>}
          actions={<>
            <button className="icon-btn" onClick={() => setSections(x => move(x, si, -1))} aria-label="up">▲</button>
            <button className="icon-btn" onClick={() => setSections(x => move(x, si, 1))} aria-label="down">▼</button>
            <button className="icon-btn" onClick={() => setSections(x => x.filter((_, k) => k !== si))} aria-label={t('c.delete')}><Icon name="trash" size={17} /></button>
          </>}>
          <div className="grid g4">
            <Field label={t('c.nameEn')}><input dir="ltr" value={s.title.en} onChange={e => updSec(si, { title: { ...s.title, en: e.target.value } })} /></Field>
            <Field label={t('c.nameAr')}><input dir="rtl" value={s.title.ar} onChange={e => updSec(si, { title: { ...s.title, ar: e.target.value } })} /></Field>
            <Field label={t('c.discipline')}><select value={s.discipline} onChange={e => updSec(si, { discipline: e.target.value as Discipline })}>
              {DISCIPLINES.map(d => <option key={d} value={d}>{t('disc.' + d)}</option>)}</select></Field>
            <Field label={t('tpl.stage')}><input value={s.stage} onChange={e => updSec(si, { stage: e.target.value })} /></Field>
          </div>
          <div className="stack mt">
            {s.items.map((it, ii) => (
              <div key={it.id} className="card" style={{ background: '#fafbfd', padding: 12 }}>
                <div className="grid g2">
                  <Field label={`${ii + 1}. ${t('c.nameEn')}`}><input dir="ltr" value={it.label.en} onChange={e => updItem(si, ii, { label: { ...it.label, en: e.target.value } })} /></Field>
                  <Field label={t('c.nameAr')}><input dir="rtl" value={it.label.ar} onChange={e => updItem(si, ii, { label: { ...it.label, ar: e.target.value } })} /></Field>
                </div>
                <div className="row gap wrap mt">
                  <label className="check"><input type="checkbox" checked={it.mandatory} onChange={e => updItem(si, ii, { mandatory: e.target.checked })} />{t('it.mandatory')}</label>
                  <label className="check"><input type="checkbox" checked={it.critical} onChange={e => updItem(si, ii, { critical: e.target.checked })} />{t('it.critical')}</label>
                  <label className="check"><input type="checkbox" checked={!!it.naReasonRequired} onChange={e => updItem(si, ii, { naReasonRequired: e.target.checked })} />{t('tpl.naReason')}</label>
                  <label className="check"><input type="checkbox" checked={!!it.photoRequired} onChange={e => updItem(si, ii, { photoRequired: e.target.checked })} />{t('tpl.photo')}</label>
                  <label className="check"><input type="checkbox" checked={!!it.measure} onChange={e => updItem(si, ii, { measure: e.target.checked ? { unit: '', min: null, max: null } : null })} />{t('it.measured')}</label>
                  <div className="grow" />
                  <button className="icon-btn" onClick={() => updSec(si, { items: move(s.items, ii, -1) })}>▲</button>
                  <button className="icon-btn" onClick={() => updSec(si, { items: move(s.items, ii, 1) })}>▼</button>
                  <button className="icon-btn" onClick={() => updSec(si, { items: s.items.filter((_, j) => j !== ii) })}><Icon name="trash" size={17} /></button>
                </div>
                {it.measure && (
                  <div className="grid g3 mt">
                    <Field label={t('tpl.unit')}><input className="ltr" value={it.measure.unit} onChange={e => updItem(si, ii, { measure: { ...it.measure!, unit: e.target.value } })} /></Field>
                    <Field label={t('tpl.min')}><input type="number" step="any" className="ltr" value={it.measure.min ?? ''} onChange={e => updItem(si, ii, { measure: { ...it.measure!, min: e.target.value === '' ? null : Number(e.target.value) } })} /></Field>
                    <Field label={t('tpl.max')}><input type="number" step="any" className="ltr" value={it.measure.max ?? ''} onChange={e => updItem(si, ii, { measure: { ...it.measure!, max: e.target.value === '' ? null : Number(e.target.value) } })} /></Field>
                  </div>
                )}
                <div className="grid g3 mt">
                  <Field label={t('it.procedure')}><input className="ltr" value={it.procedureRef ?? ''} onChange={e => updItem(si, ii, { procedureRef: e.target.value })} /></Field>
                  <Field label={`${t('tpl.guidance')} (EN)`}><input dir="ltr" value={it.guidance?.en ?? ''} onChange={e => updItem(si, ii, { guidance: { en: e.target.value, ar: it.guidance?.ar ?? '' } })} /></Field>
                  <Field label={`${t('tpl.guidance')} (AR)`}><input dir="rtl" value={it.guidance?.ar ?? ''} onChange={e => updItem(si, ii, { guidance: { ar: e.target.value, en: it.guidance?.en ?? '' } })} /></Field>
                </div>
              </div>
            ))}
            <button className="btn ghost" onClick={() => updSec(si, { items: [...s.items, newItem()] })}><Icon name="plus" />{t('tpl.addItem')}</button>
          </div>
        </Card>
      ))}
      <button className="btn outline" onClick={() => setSections(x => [...x, newSection()])}><Icon name="plus" />{t('tpl.addSection')}</button>

      {versions.length > 0 && (
        <Card title={t('c.history')} className="mt">
          <div className="list">{versions.map(v => (
            <div key={v.id} className="lrow"><Badge tone="blue">v{v.version}</Badge><div className="grow">{v.notes || '—'}<div className="meta">{v.createdByName} · {fmtDate(v.createdAt, true)} · {v.sections.reduce((a, s) => a + s.items.length, 0)} {t('insp.items')}</div></div></div>
          ))}</div>
        </Card>
      )}

      {publish && (
        <Modal title={t('tpl.publish')} onClose={() => setPublish(false)} footer={<>
          <button className="btn ghost" onClick={() => setPublish(false)}>{t('c.cancel')}</button>
          <button className="btn primary" disabled={busy} onClick={doPublish}>{t('tpl.publish')}</button></>}>
          <p>{t('c.version')} {(meta.currentVersion ?? 0) + 1} · {sections.reduce((a, s) => a + s.items.length, 0)} {t('insp.items')}</p>
          {problems.length > 0 && <p className="alert err">{t('c.required')}: {problems.join(', ')}</p>}
          <Field label={t('tpl.versionNotes')}><textarea value={notes} onChange={e => setNotes(e.target.value)} /></Field>
        </Modal>
      )}
    </>
  );
}
