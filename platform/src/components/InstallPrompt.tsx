import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { useI18n } from '../i18n/I18n';

/* Asks every visitor to install the PWA, unless it already runs installed.
   Chrome/Edge/Android use the native install dialog; iOS Safari has none, so we show the
   Share → "Add to Home Screen" steps instead. "Not now" hides it until the next visit. */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const KEY = 'installPromptDismissed';
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const dismissed = () => { try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; } };

export function InstallPrompt() {
  const { t } = useI18n();
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isStandalone() || dismissed()) return;
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as BeforeInstallPromptEvent); setOpen(true); };
    const onInstalled = () => { setOpen(false); setEvt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    let timer: number | undefined;
    if (isIos()) timer = window.setTimeout(() => { setIos(true); setOpen(true); }, 1200);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  if (!open) return null;

  const close = () => { setOpen(false); try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ } };
  const install = async () => {
    if (!evt) return;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    setEvt(null);
    if (outcome === 'accepted') setOpen(false); else close();
  };

  return (
    <div className="install-prompt" role="dialog" aria-labelledby="install-title">
      <img src="/icon-192.png" alt="" width={48} height={48} />
      <div className="grow">
        <b id="install-title">{t('install.title')}</b>
        <p className="muted">{ios ? t('install.ios') : t('install.body')}</p>
      </div>
      <div className="install-actions">
        {!ios && <button className="btn primary sm" onClick={install}><Icon name="download" size={16} />{t('install.btn')}</button>}
        <button className="btn ghost sm" onClick={close}>{t('install.later')}</button>
      </div>
    </div>
  );
}
