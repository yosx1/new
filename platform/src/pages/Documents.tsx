import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addDoc, deleteDoc, onSnapshot, query, serverTimestamp, updateDoc, where, type Query } from 'firebase/firestore';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { useUser } from '../auth/Auth';
import { audit, col, ref } from '../lib/db';
import { can } from '../lib/rules';
import { loadAttachment, openDataUrl, saveAttachment } from '../lib/files';
import { Badge, Card, Empty, Field, Modal, PageHead, errMsg, useFeedback } from '../components/ui';
import { Icon } from '../components/Icon';
import { ROLES, type LibraryDoc, type Role } from '../types';

const CATS = ['procedure', 'manual', 'instruction', 'criteria', 'safety', 'workorder', 'form', 'drawing'];

export default function Documents() {
  const { t, b } = useI18n();
  const user = useUser();
  const data = useData();
  const { toast, confirm } = useFeedback();
  const [params] = useSearchParams();
  const [rows, setRows] = useState<LibraryDoc[]>([]);
  const [q, setQ] = useState(params.get('q') ?? '');
  const [cat, setCat] = useState('');
  const [form, setForm] = useState<null | { en: string; ar: string; category: string; url: string; file: File | null; departmentId: string; equipmentId: string; templateId: string; visibleTo: (Role | 'all')[] }>(null);
  const [busy, setBusy] = useState(false);
  const canAdd = can.createInspection(user);

  useEffect(() => {
    // Non-admins can only query documents visible to them (enforced by security rules too).
    const qy: Query = user.role === 'admin' ? col('documents') : query(col('documents'), where('visibleTo', 'array-contains-any', ['all', user.role]));
    return onSnapshot(qy, s => setRows(s.docs.map(d => ({ id: d.id, ...d.data() }) as LibraryDoc)), () => {});
  }, [user.role]);

  const list = rows.filter(d => (!cat || d.category === cat) && (!q || `${d.title.en} ${d.title.ar}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b2) => a.title.en.localeCompare(b2.title.en));

  const open = async (d: LibraryDoc) => {
    if (d.attachmentId) { const a = await loadAttachment(d.attachmentId); if (a) openDataUrl(a.data); return; }
    if (d.url) window.open(d.url, '_blank', 'noopener');
  };
  const save = async () => {
    if (!form) return;
    if (!(form.en || form.ar) || (!form.url && !form.file)) { toast(t('doc.needFileOrUrl'), 'err'); return; }
    setBusy(true);
    try {
      const r = await addDoc(col('documents'), {
        title: { en: form.en, ar: form.ar }, category: form.category, url: form.url.trim(), attachmentId: null,
        departmentId: form.departmentId || null, equipmentId: form.equipmentId || null, templateId: form.templateId || null,
        visibleTo: form.visibleTo.length ? form.visibleTo : ['all'], createdAt: serverTimestamp(), createdBy: user.id,
      });
      if (form.file) {
        const aid = await saveAttachment(user, form.file, { ownerType: 'document', ownerId: r.id, kind: 'file' });
        await updateDoc(r, { attachmentId: aid });
      }
      audit(user, 'document.create', 'document', r.id, { label: form.en || form.ar });
      toast(t('c.saved')); setForm(null);
    } catch (e) { toast(errMsg(e, t), 'err'); } finally { setBusy(false); }
  };
  const remove = async (d: LibraryDoc) => {
    if (!(await confirm(t('c.delete'), b(d.title), true))) return;
    try { await deleteDoc(ref('documents', d.id)); audit(user, 'document.delete', 'document', d.id, { label: d.title.en }); } catch (e) { toast(errMsg(e, t), 'err'); }
  };

  return (
    <>
      <PageHead title={t('doc.title')} actions={canAdd && <button className="btn primary" onClick={() => setForm({ en: '', ar: '', category: 'procedure', url: '', file: null, departmentId: '', equipmentId: '', templateId: '', visibleTo: ['all'] })}><Icon name="plus" />{t('doc.add')}</button>} />
      <div className="filters">
        <div className="search" style={{ gridColumn: 'span 2' }}><Icon name="search" size={18} /><input type="search" placeholder={t('c.search')} value={q} onChange={e => setQ(e.target.value)} /></div>
        <select value={cat} onChange={e => setCat(e.target.value)}><option value="">{t('c.category')}: {t('c.all')}</option>{CATS.map(c => <option key={c} value={c}>{t('doc.cat.' + c)}</option>)}</select>
      </div>
      <Card>
        {list.length === 0 ? <Empty icon="book" /> : (
          <div className="list">
            {list.map(d => (
              <div key={d.id} className="lrow">
                <Icon name={d.attachmentId ? 'file' : 'link'} />
                <button className="grow" style={{ border: 0, background: 'none', textAlign: 'start', padding: 0 }} onClick={() => open(d)} disabled={!d.url && !d.attachmentId}>
                  <b>{b(d.title)}</b>
                  <div className="meta">{t('doc.cat.' + d.category)}
                    {d.departmentId && ` · ${b(data.dept(d.departmentId)?.name)}`}{d.equipmentId && ` · ${data.eq(d.equipmentId)?.tag ?? ''}`}{d.templateId && ` · ${d.templateId}`}
                    {!d.url && !d.attachmentId && ` · ${t('doc.needFileOrUrl')}`}</div>
                </button>
                {!d.visibleTo.includes('all') && <Badge tone="purple" icon="lock">{d.visibleTo.length}</Badge>}
                {user.role === 'admin' && <button className="icon-btn" onClick={() => remove(d)}><Icon name="trash" size={17} /></button>}
              </div>
            ))}
          </div>
        )}
      </Card>
      {form && (
        <Modal title={t('doc.add')} onClose={() => setForm(null)} footer={<>
          <button className="btn ghost" onClick={() => setForm(null)}>{t('c.cancel')}</button>
          <button className="btn primary" disabled={busy} onClick={save}>{t('c.save')}</button></>}>
          <Field label={t('c.nameEn')}><input dir="ltr" value={form.en} onChange={e => setForm({ ...form, en: e.target.value })} /></Field>
          <Field label={t('c.nameAr')}><input dir="rtl" value={form.ar} onChange={e => setForm({ ...form, ar: e.target.value })} /></Field>
          <Field label={t('c.category')}><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{CATS.map(c => <option key={c} value={c}>{t('doc.cat.' + c)}</option>)}</select></Field>
          <Field label={t('c.link')} hint={t('set.free')}><input type="url" className="ltr" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://" /></Field>
          <Field label={t('c.addFile')} hint="≤ 650 KB"><input type="file" accept="application/pdf,image/*" onChange={e => setForm({ ...form, file: e.target.files?.[0] ?? null })} /></Field>
          <div className="grid g3">
            <Field label={t('c.department')}><select value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })}><option value="">—</option>{data.departments.map(d => <option key={d.id} value={d.id}>{b(d.name)}</option>)}</select></Field>
            <Field label={t('c.equipment')}><select value={form.equipmentId} onChange={e => setForm({ ...form, equipmentId: e.target.value })}><option value="">—</option>{data.equipment.map(e => <option key={e.id} value={e.id}>{e.tag}</option>)}</select></Field>
            <Field label={t('insp.template')}><select value={form.templateId} onChange={e => setForm({ ...form, templateId: e.target.value })}><option value="">—</option>{data.templates.map(x => <option key={x.id} value={x.id}>{x.code}</option>)}</select></Field>
          </div>
          <Field label={t('doc.visible')}>
            <div className="chips">
              <button type="button" className={'chip' + (form.visibleTo.includes('all') ? ' on' : '')} onClick={() => setForm({ ...form, visibleTo: ['all'] })}>{t('doc.everyone')}</button>
              {ROLES.map(r => {
                const on = form.visibleTo.includes(r);
                return <button type="button" key={r} className={'chip' + (on ? ' on' : '')} onClick={() => {
                  const base = form.visibleTo.filter(x => x !== 'all');
                  setForm({ ...form, visibleTo: on ? base.filter(x => x !== r) : [...base, r] });
                }}>{t('role.' + r)}</button>;
              })}
            </div>
          </Field>
        </Modal>
      )}
    </>
  );
}
