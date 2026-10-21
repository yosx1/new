import { useState } from 'react';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { useUser } from '../auth/Auth';
import { archiveShutdown, renameShutdown } from '../lib/actions';
import { can } from '../lib/rules';
import { Badge, Card, Field, Modal, Progress, errMsg, useFeedback } from './ui';
import type { Shutdown } from '../types';
import { Icon } from './Icon';

/** The current yearly shutdown, and — once every inspection is approved — the button that archives them. */
export function ShutdownCard() {
  const { t, fmtDate } = useI18n();
  const user = useUser();
  const data = useData();
  const { toast, confirm } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(false);
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
    <Card className="shutdown-card" title={<><Icon name="factory" size={18} /> {sd.name} <Badge tone="blue">{t('sd.open')}</Badge></>}
      actions={can.manageSystem(user) && <button className="btn sm ghost" onClick={() => setEdit(true)}><Icon name="edit" size={15} />{t('c.edit')}</button>}>
      {edit && <ShutdownEdit sd={sd} onClose={() => setEdit(false)} />}
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

/** Administrator: rename a shutdown / project or correct its year. */
export function ShutdownEdit({ sd, onClose }: { sd: Shutdown; onClose: () => void }) {
  const { t } = useI18n();
  const user = useUser();
  const data = useData();
  const { toast } = useFeedback();
  const [name, setName] = useState(sd.name);
  const [year, setYear] = useState(String(sd.year));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const y = Number(year);
    if (!name.trim() || name.trim().length > 100) { toast(t('c.required'), 'err'); return; }
    if (!Number.isInteger(y) || y < 2000 || y > 2100) { toast(t('sd.badYear'), 'err'); return; }
    setBusy(true);
    try { await renameShutdown(user, sd, name.trim(), y); if (sd.status !== 'open') data.refreshPast(); toast(t('c.saved')); onClose(); }
    catch (e) { toast(errMsg(e, t), 'err'); } finally { setBusy(false); }
  };
  return (
    <Modal title={t('sd.edit')} onClose={onClose} footer={<>
      <button className="btn ghost" onClick={onClose}>{t('c.cancel')}</button>
      <button className="btn primary" disabled={busy} onClick={save}>{t('c.save')}</button></>}>
      <Field label={t('sd.name')} required hint={t('sd.nameHint')}><input value={name} maxLength={100} onChange={e => setName(e.target.value)} /></Field>
      <Field label={t('sd.year')} required><input type="number" min={2000} max={2100} value={year} onChange={e => setYear(e.target.value)} /></Field>
      <p className="muted small">{t('sd.editNote')}</p>
    </Modal>
  );
}
