import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { can, isLead } from '../lib/rules';
import { Card } from '../components/ui';
import { Icon } from '../components/Icon';
import { ROLES, type Role, type UserProfile } from '../types';

/* What each role may do. Built from the same permission checks the app (and the security rules) use. */
export function RolesMatrix() {
  const { t } = useI18n();
  const { settings, users } = useData();
  const as = (role: Role) => ({ id: 'x', role, active: true, discipline: 'mechanical', departmentId: null } as unknown as UserProfile);
  const own = 'priv.ownTeam';
  const rows: [string, (r: Role) => boolean | string][] = [
    ['priv.view', () => true],
    ['priv.start', r => (r === 'member' ? own : isLead(as(r)))],
    ['priv.check', r => (r === 'member' ? own : can.work(as(r), { discipline: 'electrical', departmentId: 'KLN', status: 'pool' }))],
    ['priv.approve', r => can.approve(as(r))],
    ['priv.archive', r => can.archive(as(r))],
    ['priv.equipment', r => can.manageEquipment(as(r))],
    ['priv.audit', r => can.seeAudit(as(r))],
    ['priv.export', () => true],
    ['priv.reports', r => (settings.reportRecipientUids?.length ? users.some(u => u.role === r && settings.reportRecipientUids!.includes(u.id)) : isLead(as(r)))],
    ['priv.admin', r => can.manageSystem(as(r))],
  ];
  return (
    <Card title={t('priv.title')} className="mt">
      <p className="muted small">{t('priv.desc')}</p>
      <div className="table-wrap">
        <table className="priv">
          <thead><tr><th>{t('priv.what')}</th>{ROLES.map(r => <th key={r}>{t('role.' + r)}<small>{users.filter(u => u.active && u.role === r).length}</small></th>)}</tr></thead>
          <tbody>{rows.map(([k, f]) => (
            <tr key={k}><td>{t(k)}</td>{ROLES.map(r => {
              const v = f(r);
              return <td key={r} className="c">{typeof v === 'string' ? <span className="small">{t(v)}</span> : v ? <Icon name="check" size={16} className="yes" /> : <span className="no">–</span>}</td>;
            })}</tr>
          ))}</tbody>
        </table>
      </div>
      <p className="muted small mt">{t('priv.change')}</p>
    </Card>
  );
}
