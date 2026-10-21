import { useState } from 'react';
import { serverTimestamp, setDoc, updateDoc, terminate, clearIndexedDbPersistence } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { useUser } from '../auth/Auth';
import { audit, ref } from '../lib/db';
import { seedExampleData } from '../data/seed';
import { Card, Field, PageHead, errMsg, useFeedback } from '../components/ui';
import { ReportSettings } from './ReportSettings';
import { RolesMatrix } from './RolesMatrix';
import { Icon } from '../components/Icon';
import { ROLES, SEVERITIES, type Role, type Settings } from '../types';

const csv = (a: string[]) => a.join(', ');
const parse = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const user = useUser();
  const data = useData();
  const { toast, confirm } = useFeedback();
  const [me, setMe] = useState({ name: user.name, phone: user.phone ?? '' });
  const s = data.settings;
  const [sys, setSys] = useState({
    en: s.plantName.en, ar: s.plantName.ar, shifts: csv(s.shifts), mtypes: csv(s.maintenanceTypes), cats: csv(s.equipmentCategories),
    overrideRoles: s.overrideRoles, days: s.defectTargetDays,
  });
  const [busy, setBusy] = useState(false);
  const admin = user.role === 'admin';

  const saveMe = async () => {
    try { await updateDoc(ref('users', user.id), { name: me.name.trim(), phone: me.phone.trim() }); toast(t('c.saved')); }
    catch (e) { toast(errMsg(e, t), 'err'); }
  };
  const saveSys = async () => {
    const next: Settings = {
      plantName: { en: sys.en, ar: sys.ar }, shifts: parse(sys.shifts), maintenanceTypes: parse(sys.mtypes), equipmentCategories: parse(sys.cats),
      overrideRoles: sys.overrideRoles, defectTargetDays: sys.days,
    };
    try {
      await setDoc(ref('config', 'settings'), { ...next, updatedAt: serverTimestamp(), updatedBy: user.id }, { merge: true });
      audit(user, 'settings.edit', 'config', 'settings', { after: { overrideRoles: next.overrideRoles } });
      toast(t('c.saved'));
    } catch (e) { toast(errMsg(e, t), 'err'); }
  };
  const seed = async () => {
    if (!(await confirm(t('setup.seed'), t('tpl.exampleWarn')))) return;
    setBusy(true);
    try { await seedExampleData(user); audit(user, 'seed', 'config', 'seed'); toast(t('setup.seedDone')); }
    catch (e) { toast(errMsg(e, t), 'err'); } finally { setBusy(false); }
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
      <PageHead title={t('nav.settings')} />
      <div className="grid g2">
        <Card title={t('nav.profile')}>
          <div className="stack">
            <Field label={t('c.name')}><input value={me.name} onChange={e => setMe({ ...me, name: e.target.value })} /></Field>
            <Field label={t('usr.phone')}><input type="tel" className="ltr" value={me.phone} onChange={e => setMe({ ...me, phone: e.target.value })} /></Field>
            <Field label={t('usr.role')}><input disabled value={t('role.' + user.role)} /></Field>
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
          {admin && data.departments.length === 0 && (
            <div className="mt"><button className="btn outline" disabled={busy} onClick={seed}><Icon name="download" />{t('setup.seed')}</button></div>
          )}
        </Card>
      </div>

      {admin && (
        <Card title={t('set.title')} className="mt">
          <div className="grid g2">
            <Field label={`${t('set.plant')} (EN)`}><input dir="ltr" value={sys.en} onChange={e => setSys({ ...sys, en: e.target.value })} /></Field>
            <Field label={`${t('set.plant')} (AR)`}><input dir="rtl" value={sys.ar} onChange={e => setSys({ ...sys, ar: e.target.value })} /></Field>
            <Field label={t('set.shifts')}><textarea value={sys.shifts} onChange={e => setSys({ ...sys, shifts: e.target.value })} /></Field>
            <Field label={t('set.mtypes')}><textarea value={sys.mtypes} onChange={e => setSys({ ...sys, mtypes: e.target.value })} /></Field>
            <Field label={t('set.categories')}><textarea value={sys.cats} onChange={e => setSys({ ...sys, cats: e.target.value })} /></Field>
            <Field label={t('set.overrideRoles')}>
              <div className="chips">{ROLES.filter(r => ['admin', 'manager', 'supervisor'].includes(r)).map(r => {
                const on = sys.overrideRoles.includes(r);
                return <button key={r} type="button" className={'chip' + (on ? ' on' : '')}
                  onClick={() => setSys({ ...sys, overrideRoles: on ? sys.overrideRoles.filter(x => x !== r) : [...sys.overrideRoles, r as Role] })}>{t('role.' + r)}</button>;
              })}</div>
            </Field>
          </div>
          <Field label={t('set.targetDays')}>
            <div className="grid g4">{SEVERITIES.map(sv => (
              <Field key={sv} label={t('sev.' + sv)}><input type="number" min={0} value={sys.days[sv]} onChange={e => setSys({ ...sys, days: { ...sys.days, [sv]: Number(e.target.value) } })} /></Field>
            ))}</div>
          </Field>
          <button className="btn primary mt" onClick={saveSys}>{t('c.save')}</button>
        </Card>
      )}
      <RolesMatrix />
      {admin && <ReportSettings />}
    </>
  );
}
