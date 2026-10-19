import { useState } from 'react';
import { serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, createAuthAccount } from '../firebase';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { useUser } from '../auth/Auth';
import { audit, ref } from '../lib/db';
import { releaseUserWork } from '../lib/actions';
import { OPEN_DEFECT } from '../lib/rules';
import { Badge, Card, Field, Modal, PageHead, errMsg, useFeedback } from '../components/ui';
import { Icon } from '../components/Icon';
import { ROLES, type Role, type UserProfile } from '../types';

type Form = { id?: string; name: string; email: string; role: Role; departmentId: string; phone: string; active: boolean; password: string };

export default function Users() {
  const { t, b } = useI18n();
  const me = useUser();
  const data = useData();
  const { toast, confirm } = useFeedback();
  const [form, setForm] = useState<Form | null>(null);
  const [q, setQ] = useState('');
  const [roleF, setRoleF] = useState('');
  const [busy, setBusy] = useState(false);

  const openWork = (uid: string) => data.defects.filter(d => OPEN_DEFECT(d) && d.assignedUid === uid).length;
  const rows = data.users.filter(u => (!roleF || u.role === roleF) && (!q || (u.name + u.email).toLowerCase().includes(q.toLowerCase())));

  const save = async () => {
    if (!form) return;
    if (!form.name.trim() || !form.email.trim() || (!form.id && form.password.length < 8)) { toast(t('c.required'), 'err'); return; }
    setBusy(true);
    try {
      const profile = { name: form.name.trim(), email: form.email.trim(), role: form.role, departmentId: form.departmentId || null, phone: form.phone.trim(), active: form.active };
      if (form.id) {
        const before = data.users.find(u => u.id === form.id);
        await updateDoc(ref('users', form.id), profile);
        audit(me, 'user.edit', 'user', form.id, { label: profile.email, before: { role: before?.role, active: before?.active }, after: { role: profile.role, active: profile.active } });
      } else {
        const uid = await createAuthAccount(profile.email, form.password);
        await setDoc(ref('users', uid), { ...profile, lang: 'ar', createdAt: serverTimestamp(), createdBy: me.id });
        audit(me, 'user.create', 'user', uid, { label: profile.email, after: { role: profile.role } });
        toast(t('usr.created'));
      }
      setForm(null);
    } catch (e) { toast(errMsg(e, t), 'err'); } finally { setBusy(false); }
  };

  const toggleActive = async (u: UserProfile) => {
    if (u.id === me.id) return;
    if (u.active && !(await confirm(t('usr.deactivate'), `${u.name} — ${t('usr.handoverDesc')}`, true))) return;
    try {
      await updateDoc(ref('users', u.id), { active: !u.active });
      audit(me, u.active ? 'user.deactivate' : 'user.activate', 'user', u.id, { label: u.email });
      if (u.active) { const n = await releaseUserWork(me, u.id); if (n) toast(`${t('usr.handoverDone')} (${n})`); }
    } catch (e) { toast(errMsg(e, t), 'err'); }
  };
  const handover = async (u: UserProfile) => {
    if (!(await confirm(t('usr.handover'), t('usr.handoverDesc')))) return;
    try { const n = await releaseUserWork(me, u.id); toast(`${t('usr.handoverDone')} (${n})`); } catch (e) { toast(errMsg(e, t), 'err'); }
  };

  return (
    <>
      <PageHead title={t('usr.title')} sub={`${data.users.filter(u => u.active).length} ${t('c.active')}`}
        actions={<button className="btn primary" onClick={() => setForm({ name: '', email: '', role: 'mechanical', departmentId: '', phone: '', active: true, password: '' })}><Icon name="plus" />{t('usr.add')}</button>} />
      <div className="filters">
        <div className="search" style={{ gridColumn: 'span 2' }}><Icon name="search" size={18} /><input type="search" placeholder={t('c.search')} value={q} onChange={e => setQ(e.target.value)} /></div>
        <select value={roleF} onChange={e => setRoleF(e.target.value)}><option value="">{t('usr.role')}: {t('c.all')}</option>{ROLES.map(r => <option key={r} value={r}>{t('role.' + r)}</option>)}</select>
      </div>
      <Card>
        <div className="list">
          {rows.map(u => {
            const n = openWork(u.id);
            return (
              <div key={u.id} className="lrow" style={{ opacity: u.active ? 1 : .55 }}>
                <Icon name="user" />
                <div className="grow">
                  <b>{u.name}</b> {u.id === me.id && <Badge tone="blue">{t('c.me')}</Badge>}
                  <div className="meta ltr" style={{ textAlign: 'start' }}>{u.email}{u.phone ? ` · ${u.phone}` : ''}</div>
                  <div className="meta">{t('role.' + u.role)} · {u.departmentId ? b(data.dept(u.departmentId)?.name) : t('usr.allDepts')}{n ? ` · ${n} ${t('nav.defects')}` : ''}</div>
                </div>
                {!u.active && <Badge tone="gray">{t('c.inactive')}</Badge>}
                <div className="row gap wrap" style={{ justifyContent: 'flex-end' }}>
                  {n > 0 && <button className="btn sm ghost" onClick={() => handover(u)} title={t('usr.handoverDesc')}>{t('usr.handover')}</button>}
                  <button className="btn sm ghost" onClick={() => setForm({ id: u.id, name: u.name, email: u.email, role: u.role, departmentId: u.departmentId ?? '', phone: u.phone ?? '', active: u.active, password: '' })}><Icon name="edit" size={15} /></button>
                  {u.id !== me.id && <button className={'btn sm ' + (u.active ? 'ghost' : 'outline')} onClick={() => toggleActive(u)}>{u.active ? t('usr.deactivate') : t('usr.activate')}</button>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {form && (
        <Modal title={form.id ? t('c.edit') : t('usr.add')} onClose={() => setForm(null)} footer={<>
          {form.id && <button className="btn ghost" onClick={() => sendPasswordResetEmail(auth, form.email).then(() => toast(t('auth.resetSent'))).catch(e => toast(errMsg(e, t), 'err'))}>{t('usr.sendReset')}</button>}
          <div className="grow" />
          <button className="btn ghost" onClick={() => setForm(null)}>{t('c.cancel')}</button>
          <button className="btn primary" disabled={busy} onClick={save}>{t('c.save')}</button></>}>
          <Field label={t('c.name')} required><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label={t('auth.email')} required><input type="email" className="ltr" value={form.email} disabled={!!form.id} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
          {!form.id && <Field label={t('usr.tempPassword')} required><input type="text" className="ltr" minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></Field>}
          <Field label={t('usr.role')} required><select value={form.role} disabled={form.id === me.id} onChange={e => setForm({ ...form, role: e.target.value as Role })}>
            {ROLES.map(r => <option key={r} value={r}>{t('role.' + r)}</option>)}</select></Field>
          <Field label={t('usr.scope')}><select value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })}>
            <option value="">{t('usr.allDepts')}</option>{data.departments.map(d => <option key={d.id} value={d.id}>{b(d.name)}</option>)}</select></Field>
          <Field label={t('usr.phone')}><input type="tel" className="ltr" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
        </Modal>
      )}
    </>
  );
}
