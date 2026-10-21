import { useEffect, useState } from 'react';
import { orderBy, query } from 'firebase/firestore';
import { deleteDoc, onSnapshot, updateDoc } from '../lib/fs';
import { useI18n } from '../i18n/I18n';
import { useDeviceDocId, useUser } from '../auth/Auth';
import { audit, col, ref } from '../lib/db';
import { Badge, Card, Empty, PageHead, errMsg, useFeedback } from '../components/ui';
import { Icon } from '../components/Icon';
import type { Device } from '../types';

export default function Devices() {
  const { t, fmtDate } = useI18n();
  const me = useUser();
  const mine = useDeviceDocId();
  const { toast, confirm } = useFeedback();
  const [rows, setRows] = useState<Device[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => onSnapshot(query(col('devices'), orderBy('lastSeen', 'desc')),
    s => setRows(s.docs.map(d => ({ id: d.id, ...d.data() }) as Device)), e => toast(errMsg(e, t), 'err')), []); // eslint-disable-line

  const setRevoked = async (d: Device, revoked: boolean) => {
    if (revoked && !(await confirm(t('dev.revoke'), `${d.userName} · ${d.label}`, true))) return;
    try {
      await updateDoc(ref('devices', d.id), { revoked, revokedBy: revoked ? me.id : null });
      audit(me, revoked ? 'device.revoke' : 'device.restore', 'device', d.id, { label: `${d.userName} · ${d.label}` });
    } catch (e) { toast(errMsg(e, t), 'err'); }
  };
  const remove = async (d: Device) => {
    if (!(await confirm(t('c.delete'), `${d.userName} · ${d.label}`, true))) return;
    try { await deleteDoc(ref('devices', d.id)); audit(me, 'device.delete', 'device', d.id, { label: d.label }); } catch (e) { toast(errMsg(e, t), 'err'); }
  };
  const list = rows.filter(d => !q || `${d.userName} ${d.label} ${d.platform}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHead title={t('dev.title')} sub={t('dev.desc')} />
      <div className="filters"><div className="search" style={{ gridColumn: 'span 2' }}><Icon name="search" size={18} />
        <input type="search" placeholder={t('c.search')} value={q} onChange={e => setQ(e.target.value)} /></div></div>
      <Card>
        {list.length === 0 ? <Empty icon="phone" /> : (
          <div className="list">
            {list.map(d => (
              <div key={d.id} className="lrow" style={{ opacity: d.revoked ? .6 : 1 }}>
                <Icon name={d.platform === 'mobile' ? 'phone' : 'dashboard'} />
                <div className="grow">
                  <b>{d.userName}</b> · {d.label} {d.id === mine && <Badge tone="blue">{t('dev.thisDevice')}</Badge>}
                  <div className="meta">{t('dev.lastSeen')}: <span className="ltr">{fmtDate(d.lastSeen, true)}</span> · v{d.appVersion}</div>
                  <div className="meta ellipsis ltr" style={{ textAlign: 'start' }}>{d.userAgent}</div>
                </div>
                {d.revoked && <Badge tone="red">{t('dev.revoked')}</Badge>}
                {d.id !== mine && (d.revoked
                  ? <button className="btn sm outline" onClick={() => setRevoked(d, false)}>{t('dev.restore')}</button>
                  : <button className="btn sm danger" onClick={() => setRevoked(d, true)}>{t('dev.revoke')}</button>)}
                {d.id !== mine && <button className="icon-btn" onClick={() => remove(d)} aria-label={t('c.delete')}><Icon name="trash" size={17} /></button>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
