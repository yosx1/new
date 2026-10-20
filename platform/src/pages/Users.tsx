import { useEffect, useState } from 'react';
import { deleteDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, createAuthAccount } from '../firebase';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { useUser } from '../auth/Auth';
import { audit, col, ref } from '../lib/db';
import { releaseUserWork } from '../lib/actions';
import { OPEN_DEFECT } from '../lib/rules';
import { Badge, Card, Field, Modal, PageHead, errMsg, useFeedback } from '../components/ui';
import { Icon } from '../components/Icon';
import { ROLES, type Role, type UserProfile } from '../types';

type Invite = { id: string; email: string; name: string; role: Role; departmentId: string | null; phone?: string };
type Form = { id?: string; name: string; email: string; role: Role; departmentId: string; phone: string; active: boolean; password: string };

// Never shown to anyone: the person sets their own password from the e-mailed link (or uses Google).
const randomPassword = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), x => x.toString(36).padStart(2, '0')).join('') + 'Aa1';

export default function Users() {
  const { t, b } = useI18n();
  const me = useUser();
  const data = useData();
  const { toast, confirm } = useFeedback();
  const [form, setForm] = useState<Form | null>(null);
  const [q, setQ] = useState('');
  const [roleF, setRoleF] = useState('');
  const [busy, setBusy] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  useEffect(() => onSnapshot(query(col('invites'), orderBy('createdAt', 'desc')),
    s => setInvites(s.docs.map(d => ({ id: d.id, ...d.data() }) as Invite)), () => setInvites([])), []);

  const openWork = (uid: string) => data.defects.filter(d => OPEN_DEFECT(d) && d.assignedUid === uid).length;
  const rows = data.users.filter(u => (!roleF || u.role === roleF) && (!q || (u.name + u.email).toLowerCase().includes(q.toLowerCase())));

  const save = async () => {
    if (!form) return;
    if (!form.name.trim() || !form.email.trim()) { toast(t('c.required'), 'err'); return; }
    if (!form.id && form.password && form.password.length < 8) { toast(t('usr.pwShort'), 'err'); return; }
    const email = form.email.trim().toLowerCase();
    if (!form.id && (data.users.some(u => u.email.toLowerCase() === email) || invites.some(i => i.id === email))) { toast(t('usr.exists'), 'err'); return; }
    setBusy(true);
    try {
      const profile = { name: form.name.trim(), email: form.id ? form.email : email, role: form.role, departmentId: form.departmentId || null, phone: form.phone.trim(), active: form.active };
      if (form.id) {
        const before = data.users.find(u => u.id === form.id);
        await updateDoc(ref('users', form.id), profile);
        audit(me, 'user.edit', 'user', form.id, { label: profile.email, before: { role: before?.role, active: before?.active }, after: { role: profile.role, active: profile.active } });
      } else {
        let uid: string | null = null;
        try { uid = await createAuthAccount(email, form.password || randomPassword()); }
        catch (e) { if ((e as { code?: string }).code !== 'auth/email-already-in-use') throw e; }
        if (uid) {
          await setDoc(ref('users', uid), { ...profile, lang: 'ar', createdAt: serverTimestamp(), createdBy: me.id });
          audit(me, 'user.create', 'user', uid, { label: email, after: { role: profile.role } });
        } else {
          // The e-mail already has a login (e.g. they tried Google first): they get access on their next sign-in.
          await setDoc(ref('invites', email), { email, name: profile.name, role: profile.role, departmentId: profile.departmentId,
            phone: profile.phone, invitedBy: me.id, createdAt: serverTimestamp() });
          audit(me, 'user.invite', 'user', email, { label: email, after: { role: profile.role } });
        }
        if (!form.password) await sendPasswordResetEmail(auth, email).catch(() => {});
        toast(uid ? (form.password ? t('usr.created') : t('usr.invited')) : t('usr.invitePending'));
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

  const cancelInvite = async (i: Invite) => {
    if (!(await confirm(t('usr.cancelInvite'), i.email, true))) return;
    try { await deleteDoc(ref('invites', i.id)); audit(me, 'user.uninvite', 'user', i.id, { label: i.email }); } catch (e) { toast(errMsg(e, t), 'err'); }
  };
  const resend = (email: string) => sendPasswordResetEmail(auth, email).then(() => toast(t('usr.inviteSent'))).catch(e => toast(errMsg(e, t), 'err'));

  return (
    <>
      <PageHead title={t('usr.title')} sub={`${data.users.filter(u => u.active).length} ${t('c.active')}`}
        actions={<button className="btn primary" onClick={() => setForm({ name: '', email: '', role: 'mechanical', departmentId: '', phone: '', active: true, password: '' })}><Icon name="plus" />{t('usr.add')}</button>} />
      <div className="filters">
        <div className="search" style={{ gridColumn: 'span 2' }}><Icon name="search" size={18} /><input type="search" placeholder={t('c.search')} value={q} onChange={e => setQ(e.target.value)} /></div>
        <select value={roleF} onChange={e => setRoleF(e.target.value)}><option value="">{t('usr.role')}: {t('c.all')}</option>{ROLES.map(r => <option key={r} value={r}>{t('role.' + r)}</option>)}</select>
      </div>
      {invites.length > 0 && (
        <Card title={`${t('usr.pending')} (${invites.length})`}>
          <p className="muted small">{t('usr.pendingDesc')}</p>
          <div className="list">
            {invites.map(i => (
              <div key={i.id} className="lrow">
                <Icon name="clock" />
                <div className="grow">
                  <b>{i.name}</b>
                  <div className="meta ltr" style={{ textAlign: 'start' }}>{i.email}</div>
                  <div className="meta">{t('role.' + i.role)} · {i.departmentId ? b(data.dept(i.departmentId)?.name) : t('usr.allDepts')}</div>
                </div>
                <div className="row gap wrap" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn sm ghost" onClick={() => resend(i.email)}>{t('usr.resend')}</button>
                  <button className="btn sm ghost" onClick={() => cancelInvite(i)}><Icon name="trash" size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
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
          {!form.id && <p className="alert info">{t('usr.inviteHow')}</p>}
          {!form.id && <Field label={t('usr.tempPassword')} hint={t('usr.tempPasswordHint')}><input type="text" className="ltr" minLength={8} autoComplete="off" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></Field>}
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
