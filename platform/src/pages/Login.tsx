import { useEffect, useState } from 'react';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db, isConfigured } from '../firebase';
import { useI18n } from '../i18n/I18n';
import { Field, Spinner, useFeedback, errMsg } from '../components/ui';
import { Icon } from '../components/Icon';

export function Login({ reason }: { reason?: 'inactive' | 'revoked' | 'noProfile' }) {
  const { t, lang, setLang } = useI18n();
  const { toast } = useFeedback();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isConfigured) return;
    getDoc(doc(db, 'config', 'setup')).then(s => setNeedsSetup(!s.exists())).catch(() => setNeedsSetup(false));
  }, []);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await signInWithEmailAndPassword(auth, email.trim(), password); }
    catch { setError(t('auth.bad')); }
    finally { setBusy(false); }
  };

  const setup = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const b = writeBatch(db);
      b.set(doc(db, 'users', cred.user.uid), {
        name: name.trim(), email: email.trim(), role: 'admin', active: true, departmentId: null, lang,
        createdAt: serverTimestamp(), createdBy: cred.user.uid,
      });
      b.set(doc(db, 'config', 'setup'), { adminUid: cred.user.uid, at: serverTimestamp() });
      await b.commit();
    } catch (err) { setError(errMsg(err, t)); }
    finally { setBusy(false); }
  };

  const reset = async () => {
    if (!email) { setError(t('auth.email')); return; }
    try { await sendPasswordResetEmail(auth, email.trim()); toast(t('auth.resetSent')); } catch (err) { setError(errMsg(err, t)); }
  };

  const reasonMsg = reason === 'inactive' ? t('auth.inactive') : reason === 'revoked' ? t('auth.revoked') : reason === 'noProfile' ? t('auth.noProfile') : '';

  return (
    <div className="login">
      <div className="login-hero">
        <img src="/icon.svg" alt="" width={72} height={72} />
        <h1>{t('app.name')}</h1>
        <p>{t('plant.default')} · {t('app.sub')}</p>
      </div>
      <div className="login-card">
        <button className="btn ghost sm lang-btn" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}><Icon name="globe" size={16} />{t('lang.switch')}</button>
        {!isConfigured ? <p className="alert warn">{t('setup.notConfigured')}</p>
          : needsSetup === null ? <Spinner />
          : needsSetup ? (
            <form onSubmit={setup} className="stack">
              <h2>{t('setup.title')}</h2>
              <p className="muted">{t('setup.desc')}</p>
              <Field label={t('c.name')} required><input value={name} onChange={e => setName(e.target.value)} required autoComplete="name" /></Field>
              <Field label={t('auth.email')} required><input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></Field>
              <Field label={t('auth.password')} required><input type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" /></Field>
              {error && <p className="alert err">{error}</p>}
              <button className="btn primary block" disabled={busy}>{t('setup.create')}</button>
            </form>
          ) : (
            <form onSubmit={signIn} className="stack">
              <h2>{t('auth.title')}</h2>
              {reasonMsg && <p className="alert warn">{reasonMsg}</p>}
              <Field label={t('auth.email')}><input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" /></Field>
              <Field label={t('auth.password')}><input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" /></Field>
              {error && <p className="alert err">{error}</p>}
              <button className="btn primary block" disabled={busy}>{t('auth.signin')}</button>
              <button type="button" className="btn link" onClick={reset}>{t('auth.forgot')}</button>
            </form>
          )}
      </div>
    </div>
  );
}
