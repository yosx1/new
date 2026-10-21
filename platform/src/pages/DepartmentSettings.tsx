import { useState } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { setDoc, updateDoc } from '../lib/fs';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { useUser } from '../auth/Auth';
import { audit, ref } from '../lib/db';
import { Badge, Card, Field, Modal, errMsg, useFeedback } from '../components/ui';
import { Icon } from '../components/Icon';
import type { Department } from '../types';

type Form = { id?: string; en: string; ar: string; order: string };

/** Administrator: rename, add, reorder and retire departments. Retired ones stay on old records. */
export function DepartmentSettings() {
  const { t, b } = useI18n();
  const user = useUser();
  const data = useData();
  const { toast, confirm } = useFeedback();
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const all = data.allDepartments;
  const count = (id: string) => data.equipment.filter(e => e.active && e.departmentId === id).length;

  const save = async () => {
    if (!form) return;
    const en = form.en.trim(), ar = form.ar.trim() || form.en.trim();
    const order = Number(form.order) || all.length + 1;
    if (!en) { toast(t('c.required'), 'err'); return; }
    if (all.some(d => d.id !== form.id && d.name.en.toLowerCase() === en.toLowerCase())) { toast(t('dep.duplicate'), 'err'); return; }
    setBusy(true);
    try {
      if (form.id) {
        await updateDoc(ref('departments', form.id), { name: { en, ar }, order, updatedAt: serverTimestamp() });
      } else {
        const code = (en.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10) || 'DEP') + '-' + Date.now().toString(36).slice(-3).toUpperCase();
        await setDoc(ref('departments', code), { code, name: { en, ar }, order, active: true, createdAt: serverTimestamp(), createdBy: user.id });
      }
      audit(user, form.id ? 'department.edit' : 'department.add', 'department', form.id ?? en, { label: en });
      setForm(null);
    } catch (e) { toast(errMsg(e, t), 'err'); } finally { setBusy(false); }
  };
  const toggle = async (d: Department) => {
    const retire = d.active !== false;
    if (retire && !(await confirm(t('dep.retire'), t('dep.retireDesc', { name: b(d.name), n: count(d.id) }), true))) return;
    try { await updateDoc(ref('departments', d.id), { active: !retire, updatedAt: serverTimestamp() }); audit(user, retire ? 'department.retire' : 'department.restore', 'department', d.id, { label: d.name.en }); }
    catch (e) { toast(errMsg(e, t), 'err'); }
  };

  return (
    <Card title={t('dep.title')} className="mt" actions={<button className="btn sm primary" onClick={() => setForm({ en: '', ar: '', order: String(all.length + 1) })}><Icon name="plus" size={15} />{t('dep.add')}</button>}>
      <div className="list">
        {all.map(d => (
          <div key={d.id} className="lrow" style={{ opacity: d.active === false ? 0.55 : 1 }}>
            <span className="part-n">{d.order}</span>
            <div className="grow"><b>{d.name.en}</b> · <span dir="rtl">{d.name.ar}</span> {d.active === false && <Badge tone="gray">{t('dep.retired')}</Badge>}
              <div className="meta">{count(d.id)} {t('eq.count')}</div></div>
            <button className="btn sm ghost" onClick={() => setForm({ id: d.id, en: d.name.en, ar: d.name.ar, order: String(d.order) })} aria-label={t('c.edit')}><Icon name="edit" size={15} /></button>
            <button className="btn sm ghost" onClick={() => toggle(d)}>{d.active === false ? t('dep.restore') : t('dep.retire')}</button>
          </div>
        ))}
      </div>
      {form && (
        <Modal title={form.id ? t('c.edit') : t('dep.add')} onClose={() => setForm(null)} footer={<>
          <button className="btn ghost" onClick={() => setForm(null)}>{t('c.cancel')}</button>
          <button className="btn primary" disabled={busy} onClick={save}>{t('c.save')}</button></>}>
          <Field label={`${t('c.name')} (EN)`} required><input dir="ltr" value={form.en} onChange={e => setForm({ ...form, en: e.target.value })} /></Field>
          <Field label={`${t('c.name')} (AR)`}><input dir="rtl" value={form.ar} onChange={e => setForm({ ...form, ar: e.target.value })} /></Field>
          <Field label={t('dep.order')}><input type="number" min={1} value={form.order} onChange={e => setForm({ ...form, order: e.target.value })} /></Field>
        </Modal>
      )}
    </Card>
  );
}
