import { useState } from 'react';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { useUser } from '../auth/Auth';
import { archiveShutdown } from '../lib/actions';
import { can } from '../lib/rules';
import { Badge, Card, Progress, errMsg, useFeedback } from './ui';
import { Icon } from './Icon';

/** The current yearly shutdown, and — once every inspection is approved — the button that archives them. */
export function ShutdownCard() {
  const { t, fmtDate } = useI18n();
  const user = useUser();
  const data = useData();
  const { toast, confirm } = useFeedback();
  const [busy, setBusy] = useState(false);
  const sd = data.shutdown;
  if (!sd) return <Card title={t('sd.title')}><p className="muted">{t('sd.none')}</p></Card>;

  const mine = data.inspections.filter(i => i.shutdownId === sd.id && i.status !== 'archived');
  const approved = mine.filter(i => i.status === 'approved').length;
  const ready = mine.length > 0 && approved === mine.length;
  const archive = async () => {
    if (!(await confirm(t('sd.archive'), t('sd.archiveDesc', { n: approved, name: sd.name })))) return;
    setBusy(true);
    try { const next = await archiveShutdown(user, sd, data.inspections); toast(t('sd.archived', { n: approved, next: next.name })); }
    catch (e) { toast(errMsg(e, t), 'err'); } finally { setBusy(false); }
  };

  return (
    <Card className="shutdown-card" title={<><Icon name="factory" size={18} /> {sd.name} <Badge tone="blue">{t('sd.open')}</Badge></>}>
      <div className="row between wrap gap">
        <div className="grow" style={{ minWidth: 220 }}>
          <Progress value={mine.length ? (approved / mine.length) * 100 : 0} tone={ready ? 'green' : 'blue'} />
          <p className="small muted mt0">{t('sd.progress', { a: approved, b: mine.length })}{sd.startedAt ? ` · ${t('sd.since')} ${fmtDate(sd.startedAt)}` : ''}</p>
        </div>
        {can.archive(user) && (ready
          ? <button className="btn success" disabled={busy} onClick={archive}><Icon name="check" />{t('sd.archive')}</button>
          : <span className="small muted">{mine.length ? t('sd.notReady') : t('sd.empty')}</span>)}
      </div>
    </Card>
  );
}
