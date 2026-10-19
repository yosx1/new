import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getDocs, limit, orderBy, query, startAfter, type QueryDocumentSnapshot } from 'firebase/firestore';
import { useI18n } from '../i18n/I18n';
import { useUser } from '../auth/Auth';
import { col } from '../lib/db';
import { can } from '../lib/rules';
import { downloadText, toCsv } from '../lib/files';
import { Card, Empty, PageHead, Spinner } from '../components/ui';
import { Icon } from '../components/Icon';
import type { AuditEvent } from '../types';

export default function Audit() {
  const { t, fmtDate } = useI18n();
  const user = useUser();
  const [rows, setRows] = useState<AuditEvent[]>([]);
  const [last, setLast] = useState<QueryDocumentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [q, setQ] = useState('');

  const load = async (after?: QueryDocumentSnapshot | null) => {
    setLoading(true);
    const s = await getDocs(query(col('audit'), orderBy('at', 'desc'), ...(after ? [startAfter(after)] : []), limit(150))).catch(() => null);
    if (s) {
      setRows(r => [...(after ? r : []), ...s.docs.map(d => ({ id: d.id, ...d.data() }) as AuditEvent)]);
      setLast(s.docs[s.docs.length - 1] ?? null);
      if (s.size < 150) setDone(true);
    }
    setLoading(false);
  };
  useEffect(() => { if (can.seeAudit(user)) load(); }, []); // eslint-disable-line
  if (!can.seeAudit(user)) return <Navigate to="/" replace />;

  const list = rows.filter(a => !q || `${a.userName} ${a.action} ${a.label} ${a.note} ${a.entity}`.toLowerCase().includes(q.toLowerCase()));
  const exportCsv = () => downloadText('audit-log.csv', toCsv([
    ['Time', 'User', 'Action', 'Record', 'Label', 'Before', 'After', 'Note'],
    ...list.map(a => [fmtDate(a.at, true), a.userName, a.action, `${a.entity}/${a.entityId}`, a.label, JSON.stringify(a.before ?? ''), JSON.stringify(a.after ?? ''), a.note]),
  ]));

  return (
    <>
      <PageHead title={t('aud.title')} actions={<button className="btn ghost" onClick={exportCsv}><Icon name="download" />{t('c.exportCsv')}</button>} />
      <div className="filters"><div className="search" style={{ gridColumn: 'span 2' }}><Icon name="search" size={18} />
        <input type="search" placeholder={t('c.search')} value={q} onChange={e => setQ(e.target.value)} /></div></div>
      <Card>
        {list.length === 0 && !loading ? <Empty /> : (
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>{t('c.date')}</th><th>{t('aud.user')}</th><th>{t('aud.action')}</th><th>{t('aud.entity')}</th><th>{t('c.details')}</th></tr></thead>
            <tbody>{list.map(a => (
              <tr key={a.id}>
                <td className="ltr small" style={{ whiteSpace: 'nowrap' }}>{fmtDate(a.at, true)}</td>
                <td>{a.userName}</td>
                <td><code>{a.action}</code></td>
                <td>{a.label || a.entityId}</td>
                <td className="small muted">{a.note}{a.before ? ` ${JSON.stringify(a.before)} →` : ''}{a.after ? ` ${JSON.stringify(a.after)}` : ''}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        {loading && <Spinner />}
        {!done && !loading && <button className="btn ghost block mt" onClick={() => load(last)}>{t('c.history')} …</button>}
      </Card>
    </>
  );
}
