import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { useUser } from '../auth/Auth';
import { audit, ref } from '../lib/db';
import { can, OPEN_DEFECT } from '../lib/rules';
import { Badge, Card, Empty, Field, Modal, PageHead, StatusBadge, errMsg, useFeedback } from '../components/ui';
import { Icon } from '../components/Icon';
import type { Department, Equipment } from '../types';
import { Tip } from '../components/Tips';

const blankEq = (): Omit<Equipment, 'id'> => ({
  tag: '', name: { en: '', ar: '' }, departmentId: '', line: '', category: '', location: '', manufacturer: '', model: '',
  parentId: null, templateIds: [], active: true, notes: '',
});

export default function EquipmentPage() {
  const { t, b } = useI18n();
  const user = useUser();
  const data = useData();
  const { toast } = useFeedback();
  const admin = can.manageSystem(user);
  const [q, setQ] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [eqForm, setEqForm] = useState<(Omit<Equipment, 'id'> & { id?: string }) | null>(null);
  const [deptForm, setDeptForm] = useState<(Omit<Department, 'id'> & { id?: string }) | null>(null);

  const latest = useMemo(() => {
    const m = new Map<string, typeof data.inspections[number]>();
    for (const i of data.inspections) if (!m.has(i.equipmentId)) m.set(i.equipmentId, i); // list is newest-first
    return m;
  }, [data.inspections]);
  const openDefects = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of data.defects) if (OPEN_DEFECT(d)) m.set(d.equipmentId, (m.get(d.equipmentId) ?? 0) + 1);
    return m;
  }, [data.defects]);

  const match = (e: Equipment) => (showInactive || e.active) && (!q || [e.tag, e.name.en, e.name.ar, e.category, e.line ?? ''].join(' ').toLowerCase().includes(q.toLowerCase()));

  const saveEq = async () => {
    if (!eqForm) return;
    const tag = eqForm.tag.trim().toUpperCase();
    if (!tag || !eqForm.departmentId || !eqForm.category || !(eqForm.name.en || eqForm.name.ar)) { toast(t('c.required'), 'err'); return; }
    if (!eqForm.id && data.equipment.some(e => e.tag === tag)) { toast(t('eq.tagExists'), 'err'); return; }
    try {
      const { id, ...rest } = eqForm;
      const rec = { ...rest, tag, updatedAt: serverTimestamp(), updatedBy: user.id };
      if (id) await updateDoc(ref('equipment', id), rec);
      else await setDoc(doc(db, 'equipment', tag), { ...rec, createdAt: serverTimestamp(), createdBy: user.id });
      audit(user, id ? 'equipment.edit' : 'equipment.create', 'equipment', id ?? tag, { label: tag, after: { active: rest.active, departmentId: rest.departmentId } });
      toast(t('c.saved')); setEqForm(null);
    } catch (e) { toast(errMsg(e, t), 'err'); }
  };
  const saveDept = async () => {
    if (!deptForm) return;
    const code = deptForm.code.trim().toUpperCase();
    if (!code || !(deptForm.name.en || deptForm.name.ar)) { toast(t('c.required'), 'err'); return; }
    try {
      const { id, ...rest } = deptForm;
      await setDoc(doc(db, 'departments', id ?? code), { ...rest, code, updatedAt: serverTimestamp() }, { merge: true });
      audit(user, id ? 'department.edit' : 'department.create', 'department', id ?? code, { label: code });
      toast(t('c.saved')); setDeptForm(null);
    } catch (e) { toast(errMsg(e, t), 'err'); }
  };

  const eqRow = (e: Equipment, depth = 0) => {
    const i = latest.get(e.id);
    const od = openDefects.get(e.id);
    const children = data.equipment.filter(c => c.parentId === e.id && match(c));
    return (
      <div key={e.id} className={depth ? 'tree-child' : ''}>
        <div className="lrow" style={{ marginTop: 6, opacity: e.active ? 1 : .55 }}>
          <Link to={`/equipment/${e.id}`} className="grow" style={{ color: 'inherit' }}>
            <b className="mono">{e.tag}</b> · {b(e.name)}
            <div className="meta">{e.category}{e.location ? ` · ${e.location}` : ''}{!e.active ? ` · ${t('c.inactive')}` : ''}</div>
          </Link>
          {!!od && <Badge tone="red" icon="alert">{od}</Badge>}
          {i ? <StatusBadge status={i.status} /> : <span className="muted small">{t('dash.noInspected')}</span>}
          {admin && <button className="icon-btn" aria-label={t('c.edit')} onClick={() => setEqForm({ ...blankEq(), ...e })}><Icon name="edit" size={17} /></button>}
        </div>
        {children.map(c => eqRow(c, depth + 1))}
      </div>
    );
  };

  return (
    <>
      <PageHead title={t('eq.title')} actions={admin && <>
        <button className="btn ghost" onClick={() => setDeptForm({ code: '', name: { en: '', ar: '' }, order: data.departments.length + 1, active: true })}><Icon name="plus" />{t('eq.addDept')}</button>
        <button className="btn primary" onClick={() => setEqForm(blankEq())}><Icon name="plus" />{t('eq.add')}</button>
      </>} />
      {admin && <Tip id="equipment">{t('tip.equipment')}</Tip>}
      <div className="filters">
        <div className="search" style={{ gridColumn: 'span 2' }}><Icon name="search" size={18} /><input type="search" placeholder={t('c.search')} value={q} onChange={e => setQ(e.target.value)} /></div>
        {admin && <label className="check"><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />{t('c.inactive')}</label>}
      </div>
      {data.departments.length === 0 && <Card><Empty>{t('c.empty')}</Empty></Card>}
      {data.departments.filter(d => showInactive || d.active).map(dep => {
        const list = data.equipment.filter(e => e.departmentId === dep.id && match(e));
        const roots = list.filter(e => !e.parentId || !list.some(p => p.id === e.parentId));
        const lines = [...new Set(roots.map(e => e.line || '—'))];
        if (q && !list.length) return null;
        return (
          <Card key={dep.id} className="tree-dept" title={<>{b(dep.name)} <span className="muted small mono">{dep.code}</span> <Badge tone="blue">{list.length}</Badge></>}
            actions={admin && <button className="icon-btn" onClick={() => setDeptForm({ ...dep })}><Icon name="edit" size={17} /></button>}>
            {lines.map(line => (
              <div key={line} className="tree-line"><h4>{t('eq.line')}: {line}</h4>{roots.filter(e => (e.line || '—') === line).map(e => eqRow(e))}</div>
            ))}
          </Card>
        );
      })}

      {eqForm && (
        <Modal wide title={eqForm.id ? `${t('c.edit')} · ${eqForm.tag}` : t('eq.add')} onClose={() => setEqForm(null)} footer={<>
          <button className="btn ghost" onClick={() => setEqForm(null)}>{t('c.cancel')}</button>
          <button className="btn primary" onClick={saveEq}>{t('c.save')}</button></>}>
          <div className="grid g2">
            <Field label={t('insp.tag')} required><input value={eqForm.tag} disabled={!!eqForm.id} onChange={e => setEqForm({ ...eqForm, tag: e.target.value })} className="ltr" /></Field>
            <Field label={t('c.department')} required><select value={eqForm.departmentId} onChange={e => setEqForm({ ...eqForm, departmentId: e.target.value })}>
              <option value="">{t('c.select')}</option>{data.departments.map(d => <option key={d.id} value={d.id}>{b(d.name)}</option>)}</select></Field>
            <Field label={t('c.nameEn')} required><input value={eqForm.name.en} onChange={e => setEqForm({ ...eqForm, name: { ...eqForm.name, en: e.target.value } })} dir="ltr" /></Field>
            <Field label={t('c.nameAr')} required><input value={eqForm.name.ar} onChange={e => setEqForm({ ...eqForm, name: { ...eqForm.name, ar: e.target.value } })} dir="rtl" /></Field>
            <Field label={t('insp.category')} required><select value={eqForm.category} onChange={e => setEqForm({ ...eqForm, category: e.target.value })}>
              <option value="">{t('c.select')}</option>{data.settings.equipmentCategories.map(c => <option key={c}>{c}</option>)}</select></Field>
            <Field label={t('eq.line')}><input value={eqForm.line ?? ''} onChange={e => setEqForm({ ...eqForm, line: e.target.value })} list="lines" />
              <datalist id="lines">{[...new Set(data.equipment.map(e => e.line).filter(Boolean))].map(l => <option key={l} value={l} />)}</datalist></Field>
            <Field label={t('eq.parent')}><select value={eqForm.parentId ?? ''} onChange={e => setEqForm({ ...eqForm, parentId: e.target.value || null })}>
              <option value="">{t('c.none')}</option>
              {data.equipment.filter(e => e.departmentId === eqForm.departmentId && e.id !== eqForm.id).map(e => <option key={e.id} value={e.id}>{e.tag} – {b(e.name)}</option>)}</select></Field>
            <Field label={t('eq.location')}><input value={eqForm.location ?? ''} onChange={e => setEqForm({ ...eqForm, location: e.target.value })} /></Field>
            <Field label={t('eq.manufacturer')}><input value={eqForm.manufacturer ?? ''} onChange={e => setEqForm({ ...eqForm, manufacturer: e.target.value })} /></Field>
            <Field label={t('eq.model')}><input value={eqForm.model ?? ''} onChange={e => setEqForm({ ...eqForm, model: e.target.value })} /></Field>
          </div>
          <Field label={t('eq.templates')}>
            <div className="chips">{data.templates.filter(x => x.active).map(x => {
              const on = eqForm.templateIds?.includes(x.id);
              return <button type="button" key={x.id} className={'chip' + (on ? ' on' : '')} onClick={() => setEqForm({ ...eqForm, templateIds: on ? eqForm.templateIds!.filter(y => y !== x.id) : [...(eqForm.templateIds ?? []), x.id] })}>{on && '✓ '}{x.code}</button>;
            })}</div>
          </Field>
          <Field label={t('c.notes')}><textarea value={eqForm.notes ?? ''} onChange={e => setEqForm({ ...eqForm, notes: e.target.value })} /></Field>
          <label className="check"><input type="checkbox" checked={eqForm.active} onChange={e => setEqForm({ ...eqForm, active: e.target.checked })} />{t('c.active')}</label>
        </Modal>
      )}
      {deptForm && (
        <Modal title={deptForm.id ? t('c.edit') : t('eq.addDept')} onClose={() => setDeptForm(null)} footer={<>
          <button className="btn ghost" onClick={() => setDeptForm(null)}>{t('c.cancel')}</button>
          <button className="btn primary" onClick={saveDept}>{t('c.save')}</button></>}>
          <Field label={t('c.code')} required><input value={deptForm.code} disabled={!!deptForm.id} onChange={e => setDeptForm({ ...deptForm, code: e.target.value })} className="ltr" /></Field>
          <Field label={t('c.nameEn')} required><input value={deptForm.name.en} onChange={e => setDeptForm({ ...deptForm, name: { ...deptForm.name, en: e.target.value } })} dir="ltr" /></Field>
          <Field label={t('c.nameAr')} required><input value={deptForm.name.ar} onChange={e => setDeptForm({ ...deptForm, name: { ...deptForm.name, ar: e.target.value } })} dir="rtl" /></Field>
          <Field label={t('c.order')}><input type="number" value={deptForm.order} onChange={e => setDeptForm({ ...deptForm, order: Number(e.target.value) })} /></Field>
          <label className="check"><input type="checkbox" checked={deptForm.active} onChange={e => setDeptForm({ ...deptForm, active: e.target.checked })} />{t('c.active')}</label>
        </Modal>
      )}
    </>
  );
}
