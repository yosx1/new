import { useState } from 'react';
import { useUser } from '../auth/Auth';
import { useI18n } from '../i18n/I18n';
import { GUIDE } from '../i18n/guide';
import { Card, PageHead } from '../components/ui';
import { Icon } from '../components/Icon';
import { resetTips } from '../components/Tips';

export default function Help() {
  const { t, lang } = useI18n();
  const user = useUser();
  const pick = (v: [string, string]) => (lang === 'en' ? v[0] : v[1]);
  const sections = GUIDE.filter(s => !s.roles || s.roles.includes(user.role));
  const [open, setOpen] = useState<string>(sections[0]?.id ?? '');

  return (
    <>
      <PageHead title={t('help.title')} sub={t('help.sub')} />
      <div className="guide">
        {sections.map(s => (
          <Card key={s.id} className={'guide-sec' + (open === s.id ? ' open' : '')}>
            <button className="guide-head" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? '' : s.id)}>
              <span className="guide-ico"><Icon name={s.icon} size={18} /></span>
              <b className="grow">{pick(s.title)}</b>
              <Icon name="chevron" size={18} className="guide-chev" />
            </button>
            {open === s.id && <ol className="guide-steps">{s.steps.map((x, i) => <li key={i}>{pick(x)}</li>)}</ol>}
          </Card>
        ))}
      </div>
      <p className="muted small mt">{t('help.tipsBack')} <button className="btn link sm" onClick={resetTips}>{t('help.showTips')}</button></p>
    </>
  );
}
