import { useEffect, useState } from 'react';
import { serverTimestamp, terminate, clearIndexedDbPersistence } from 'firebase/firestore';
import { setDoc, updateDoc } from '../lib/fs';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useAllInspections, useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { useUser } from '../auth/Auth';
import { audit, ref } from '../lib/db';
import { Badge, Card, Field, PageHead, Progress, errMsg, useFeedback } from '../components/ui';
import { FREE_DAILY, onSnapshot, usageDay } from '../lib/fs';
import { ReportSettings } from './ReportSettings';
import { RolesMatrix } from './RolesMatrix';
import { DepartmentSettings } from './DepartmentSettings';
import { ShutdownEdit } from '../components/ShutdownCard';
import { Icon } from '../components/Icon';
import type { Settings, Shutdown } from '../types';
import { Tip } from '../components/Tips';

export default function SettingsPage() {
  const { t, b, lang, setLang } = useI18n();
  const user = useUser();
  const data = useData();
  const { toast, confirm } = useFeedback();
  const [me, setMe] = useState({ name: user.name, phone: user.phone ?? '' });
  const s = data.settings;
  const [sys, setSys] = useState({ en: s.plantName.en, ar: s.plantName.ar });
  const admin = user.role === 'admin';

  const saveMe = async () => {
    try { await updateDoc(ref('users', user.id), { name: me.name.trim(), phone: me.phone.trim() }); toast(t('c.saved')); }
    catch (e) { toast(errMsg(e, t), 'err'); }
  };
  const saveSys = async () => {
    const next: Pick<Settings, 'plantName'> = { plantName: { en: sys.en.trim(), ar: sys.ar.trim() } };
    try {
      await setDoc(ref('config', 'settings'), { ...next, updatedAt: serverTimestamp(), updatedBy: user.id }, { merge: true });
      audit(user, 'settings.edit', 'config', 'settings', { after: next });
      toast(t('c.saved'));
    } catch (e) { toast(errMsg(e, t), 'err'); }
  };
  const clearCache = async () => {
    if (!(await confirm(t('set.clearCache'), t('c.offline'), true))) return;
    await signOut(auth);
    await terminate(db);
    await clearIndexedDbPersistence(db).catch(() => {});
    try { localStorage.clear(); } catch { /* ignore */ }
    location.reload();
  };

  return (
    <>
      <PageHead title={t(user.role === 'member' ? 'nav.profile' : 'nav.settings')} />
      {admin && <Tip id="settings">{t('tip.settings')}</Tip>}
      <div className="grid g2">
        <Card title={t('nav.profile')}>
          <div className="stack">
            <Field label={t('c.name')}><input value={me.name} onChange={e => setMe({ ...me, name: e.target.value })} /></Field>
            <Field label={t('usr.phone')}><input type="tel" className="ltr" value={me.phone} onChange={e => setMe({ ...me, phone: e.target.value })} /></Field>
            <Field label={t('usr.role')}><input disabled value={user.role === 'member' ? `${t('role.member')} · ${t('disc.' + user.discipline)}${user.departmentId ? ' · ' + b(data.dept(user.departmentId)?.name) : ''}` : t('role.' + user.role)} /></Field>
            <Field label={t('set.language')}>
              <div className="chips">
                <button className={'chip' + (lang === 'ar' ? ' on' : '')} onClick={() => setLang('ar')}>العربية</button>
                <button className={'chip' + (lang === 'en' ? ' on' : '')} onClick={() => setLang('en')}>English</button>
              </div>
            </Field>
            <button className="btn primary" onClick={saveMe}>{t('c.save')}</button>
          </div>
        </Card>
        <Card title={t('set.cache')}>
          <p className="muted">{t('set.free')}</p>
          <button className="btn ghost" onClick={clearCache}><Icon name="trash" />{t('set.clearCache')}</button>
        </Card>
      </div>

      {admin && (
        <Card title={t('set.title')} className="mt">
          <div className="grid g2">
            <Field label={`${t('set.plant')} (EN)`}><input dir="ltr" value={sys.en} onChange={e => setSys({ ...sys, en: e.target.value })} /></Field>
            <Field label={`${t('set.plant')} (AR)`}><input dir="rtl" value={sys.ar} onChange={e => setSys({ ...sys, ar: e.target.value })} /></Field>
          </div>
          <button className="btn primary mt" onClick={saveSys}>{t('c.save')}</button>
        </Card>
      )}
      {admin && <DepartmentSettings />}
      {admin && <ShutdownList />}
      {user.role !== 'member' && <RolesMatrix />}
      {admin && <ReportSettings />}
      {admin && <PlanBilling />}
    </>
  );
}

/** Administrator: links to the Firebase console to see usage or add a payment method (Blaze plan). */
function PlanBilling() {
  const { t } = useI18n();
  const console = `https://console.firebase.google.com/project/${import.meta.env.VITE_FIREBASE_PROJECT_ID}`;
  const [used, setUsed] = useState<Partial<Record<keyof typeof FREE_DAILY, number>> | null>(null);
  useEffect(() => onSnapshot(ref('usage', usageDay()), s => setUsed(s.exists() ? s.data() : null), () => setUsed(null)), []);
  return (
    <Card title={t('bill.title')} className="mt">
      <p className="muted">{t('bill.desc')}</p>
      <h3 className="mt">{t('bill.today')}</h3>
      {(['reads', 'writes', 'deletes'] as const).map(k => {
        const v = used?.[k] ?? 0, pct = Math.min(100, Math.round((v / FREE_DAILY[k]) * 100));
        return (
          <div className="bar-row mt" key={k}>
            <span>{t('bill.' + k)}</span>
            <Progress value={pct} tone={pct >= 90 ? 'red' : pct >= 75 ? 'orange' : 'green'} />
            <span className="val">{pct}%</span>
            <span className="note"><bdi dir="ltr">{v.toLocaleString()} / {FREE_DAILY[k].toLocaleString()}</bdi></span>
          </div>
        );
      })}
      <p className="small muted mt">{t('bill.alerts')}</p>
      <div className="row wrap gap mt">
        <a className="btn primary" href={`${console}/usage/details`} target="_blank" rel="noopener noreferrer"><Icon name="lock" size={16} />{t('bill.upgrade')}</a>
        <a className="btn ghost" href={`${console}/usage`} target="_blank" rel="noopener noreferrer"><Icon name="chart" size={16} />{t('bill.usage')}</a>
      </div>
      <p className="small muted mt">{t('bill.note')}</p>
    </Card>
  );
}

/** Administrator: every shutdown / project, current and past, with rename. */
function ShutdownList() {
  const { t, fmtDate } = useI18n();
  const data = useData();
  const [edit, setEdit] = useState<Shutdown | null>(null);
  const all = useAllInspections();
  return (
    <Card title={t('sd.list')} className="mt">
      <div className="list">
        {data.shutdowns.map(s => {
          const n = all.filter(i => i.shutdownId === s.id).length;
          return (
            <div key={s.id} className="lrow">
              <Icon name="factory" />
              <div className="grow"><b>{s.name}</b> {s.id === data.shutdown?.id ? <Badge tone="blue">{t('sd.open')}</Badge> : <Badge tone="gray">{t('sd.closed')}</Badge>}
                <div className="meta">{s.year} · {n} {t('nav.inspections')}{s.closedAt ? ` · ${t('sd.closedOn')} ${fmtDate(s.closedAt)}` : ''}</div></div>
              <button className="btn sm ghost" onClick={() => setEdit(s)}><Icon name="edit" size={15} />{t('c.edit')}</button>
            </div>
          );
        })}
      </div>
      {edit && <ShutdownEdit sd={edit} onClose={() => setEdit(null)} />}
    </Card>
  );
}
