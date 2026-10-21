import { useState } from 'react';
import { serverTimestamp, setDoc } from 'firebase/firestore';
import { auth } from '../firebase';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { useUser } from '../auth/Auth';
import { audit, ref } from '../lib/db';
import { reportRecipients } from '../lib/completionReport';
import { Badge, Card, Field, errMsg, useFeedback } from '../components/ui';
import { Icon } from '../components/Icon';

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const parseEmails = (s: string) => [...new Set(s.split(/[\s,;]+/).map(x => x.trim().toLowerCase()).filter(Boolean))];

/** Administrator settings: who receives completion reports, extra e-mail addresses, and the weekly backup. */
export function ReportSettings() {
  const { t, lang } = useI18n();
  const user = useUser();
  const data = useData();
  const { toast } = useFeedback();
  const s = data.settings;
  const [mode, setMode] = useState<'default' | 'custom'>(s.reportRecipientUids?.length ? 'custom' : 'default');
  const [uids, setUids] = useState<string[]>(s.reportRecipientUids ?? []);
  const [emails, setEmails] = useState((s.reportEmails ?? []).join(', '));
  const [backup, setBackup] = useState(s.backupEmail ?? '');
  const [relay, setRelay] = useState(s.emailRelayUrl ?? '');
  const [testing, setTesting] = useState(false);
  const active = data.users.filter(u => u.active).sort((a, b) => a.name.localeCompare(b.name));
  const defaults = reportRecipients({ ...s, reportRecipientUids: [] }, data.users);

  const save = async () => {
    const extra = parseEmails(emails);
    const bad = [...extra, ...(backup.trim() ? [backup.trim()] : [])].filter(e => !EMAIL.test(e));
    if (bad.length) { toast(`${t('set.badEmail')}: ${bad.join(', ')}`, 'err'); return; }
    if (relay.trim() && !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(relay.trim())) { toast(t('set.badRelay'), 'err'); return; }
    if (mode === 'custom' && !uids.length && !extra.length) { toast(t('set.noRecipients'), 'err'); return; }
    const next = { reportRecipientUids: mode === 'custom' ? uids : [], reportEmails: extra, backupEmail: backup.trim().toLowerCase(), emailRelayUrl: relay.trim() };
    try {
      await setDoc(ref('config', 'settings'), { ...next, updatedAt: serverTimestamp(), updatedBy: user.id }, { merge: true });
      audit(user, 'settings.reports', 'config', 'settings', { after: { recipients: next.reportRecipientUids.length || 'managers+admins', extra: extra.length, backupEmail: next.backupEmail } });
      toast(t('c.saved'));
    } catch (e) { toast(errMsg(e, t), 'err'); }
  };

  const test = async () => {
    if (!relay.trim()) return;
    setTesting(true);
    try {
      const res = await fetch(relay.trim(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ idToken: await auth.currentUser!.getIdToken(), test: true, lang }) });
      const out = await res.json();
      toast(out.ok ? t('set.relayOk', { email: out.sentTo ?? '', n: out.recipients ?? 0 }) : `${t('set.relayFail')}: ${out.error ?? res.status}`, out.ok ? 'ok' : 'err');
    } catch { toast(t('set.relayFail'), 'err'); } finally { setTesting(false); }
  };

  return (
    <Card title={t('set.reports')} className="mt">
      <p className="muted">{t('set.reportsDesc')}</p>
      <Field label={t('set.recipients')}>
        <div className="chips">
          <button type="button" className={'chip' + (mode === 'default' ? ' on' : '')} onClick={() => setMode('default')}>{t('set.allManagers')}</button>
          <button type="button" className={'chip' + (mode === 'custom' ? ' on' : '')} onClick={() => setMode('custom')}>{t('set.chosen')}</button>
        </div>
      </Field>
      {mode === 'default' ? (
        <p className="small muted">{defaults.length ? defaults.map(u => u.name).join(', ') : t('set.noManagers')}</p>
      ) : (
        <div className="recipients">
          {active.map(u => (
            <label key={u.id} className="check-row">
              <input type="checkbox" checked={uids.includes(u.id)} onChange={e => setUids(e.target.checked ? [...uids, u.id] : uids.filter(x => x !== u.id))} />
              <span className="grow"><b>{u.name}</b> <span className="muted small">{t('role.' + u.role)}</span></span>
              <span className="muted small ltr">{u.email}</span>
            </label>
          ))}
        </div>
      )}
      <Field label={t('set.extraEmails')} hint={t('set.extraEmailsHint')}>
        <textarea className="ltr" rows={2} value={emails} onChange={e => setEmails(e.target.value)} placeholder="name@company.com, other@company.com" />
      </Field>

      <h3 className="mt">{t('set.backup')}</h3>
      <p className="muted small">{t('set.backupDesc')}</p>
      <Field label={t('set.backupEmail')}><input type="email" className="ltr" value={backup} onChange={e => setBackup(e.target.value)} placeholder="backup@company.com" /></Field>

      <h3 className="mt">{t('set.relay')} {s.emailRelayUrl ? <Badge tone="green">{t('set.connected')}</Badge> : <Badge tone="orange">{t('set.notConnected')}</Badge>}</h3>
      <p className="muted small">{t('set.relayDesc')}</p>
      <Field label={t('set.relayUrl')}>
        <div className="row gap">
          <input className="ltr grow" value={relay} onChange={e => setRelay(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" />
          <button type="button" className="btn ghost" disabled={!relay.trim() || testing} onClick={test}><Icon name="check" size={16} />{t('set.test')}</button>
        </div>
      </Field>
      <button className="btn primary mt" onClick={save}>{t('c.save')}</button>
    </Card>
  );
}
