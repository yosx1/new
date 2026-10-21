import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../auth/Auth';
import { useI18n } from '../i18n/I18n';
import { TIPS } from '../i18n/guide';
import { useFeedback } from './ui';
import { Icon } from './Icon';

/* Dismissible tips. What was hidden is remembered per device; the guide page can bring them back. */
const KEY = 'hiddenTips';
const hidden = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; } };
const hide = (id: string) => { try { localStorage.setItem(KEY, JSON.stringify([...new Set([...hidden(), id])])); } catch { /* ignore */ } };

export function resetTips() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  window.location.assign('/');
}

/** One-line tip shown at the top of a page until dismissed. */
export function Tip({ id, children }: { id: string; children: React.ReactNode }) {
  const { t } = useI18n();
  const [show, setShow] = useState(() => !hidden().includes(id));
  if (!show) return null;
  return (
    <div className="tip mb">
      <Icon name="info" size={18} />
      <span className="grow">{children}</span>
      <button className="icon-btn sm" aria-label={t('c.close')} onClick={() => { hide(id); setShow(false); }}><Icon name="x" size={16} /></button>
    </div>
  );
}

/** Dashboard card: rotating tips for the user's role, with a link to the full guide. */
export function TipsCard() {
  const { t, lang } = useI18n();
  const user = useUser();
  const { toast } = useFeedback();
  const tips = TIPS.filter(x => !x.roles || x.roles.includes(user.role));
  const [i, setI] = useState(() => new Date().getDate() % tips.length);
  const [show, setShow] = useState(() => !hidden().includes('dashboard'));
  if (!show || !tips.length) return null;
  const tip = tips[i % tips.length].text;
  return (
    <div className="tip tip-card mb">
      <Icon name="info" size={20} />
      <div className="grow">
        <b>{t('help.tip')}</b>
        <p>{lang === 'en' ? tip[0] : tip[1]}</p>
        <div className="row gap wrap">
          <button className="btn link sm" onClick={() => setI(i + 1)}>{t('help.next')}</button>
          <Link className="btn link sm" to="/help">{t('help.open')}</Link>
        </div>
      </div>
      <button className="icon-btn sm" aria-label={t('c.close')} onClick={() => { hide('dashboard'); setShow(false); toast(t('help.hiddenToast'), 'info'); }}><Icon name="x" size={16} /></button>
    </div>
  );
}
