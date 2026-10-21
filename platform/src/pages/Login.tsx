import { useEffect, useState } from 'react';
import { GoogleAuthProvider, createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { doc, serverTimestamp } from 'firebase/firestore';
import { getDoc, writeBatch } from '../lib/fs';
import { auth, db, isConfigured } from '../firebase';
import { useI18n } from '../i18n/I18n';
import { Field, Spinner, useFeedback, errMsg } from '../components/ui';
import { Icon } from '../components/Icon';
import { NetworkBackground } from '../components/NetworkBackground';

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

  // Google accounts only get in when the administrator has added a user with the same email;
  // anyone else is signed out again with the "no profile" message.
  const google = async () => {
    setBusy(true); setError('');
    try { await signInWithPopup(auth, new GoogleAuthProvider().setCustomParameters({ prompt: 'select_account' })); }
    catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError(code === 'auth/popup-blocked' ? t('auth.popupBlocked') : errMsg(err, t));
      }
    }
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
        <NetworkBackground variant="dark" />
        <img src="/icon.svg" alt="" width={72} height={72} />
        <h1>{t('app.name')}</h1>
        <p>{t('plant.default')} · {t('app.sub')}</p>
      </div>
      <div className="login-side">
      <NetworkBackground variant="light" />
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
              <div className="or-line"><span>{t('auth.or')}</span></div>
              <button type="button" className="btn block google-btn" disabled={busy} onClick={google}>
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
                {t('auth.google')}
              </button>
              <button type="button" className="btn link" onClick={reset}>{t('auth.forgot')}</button>
            </form>
          )}
      </div>
      </div>
    </div>
  );
}
