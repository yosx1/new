import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { can } from '../lib/rules';
import { Card } from '../components/ui';
import { Icon } from '../components/Icon';
import { ROLES, type Defect, type Role, type UserProfile } from '../types';

/* What each role may do. Built from the same permission checks the app (and the security rules) use. */
export function RolesMatrix() {
  const { t } = useI18n();
  const { settings, users } = useData();
  const as = (role: Role) => ({ id: 'x', role, active: true, departmentId: null } as unknown as UserProfile);
  const ownPool = (role: Role) => ({ pool: role, repair: { by: 'someone-else' } } as unknown as Defect);
  const rows: [string, (r: Role) => boolean][] = [
    ['priv.view', () => true],
    ['priv.create', r => can.createInspection(as(r))],
    ['priv.execute', r => r !== 'viewer' && r !== 'manager'],
    ['priv.approveDisc', r => ['mechanical', 'electrical', 'instrumentation', 'production', 'manager', 'admin'].includes(r)],
    ['priv.final', r => can.finalApprove(as(r))],
    ['priv.override', r => can.override(as(r), settings)],
    ['priv.reopen', r => can.reopen(as(r))],
    ['priv.raiseDefect', r => r !== 'viewer'],
    ['priv.workDefect', r => r !== 'viewer' && can.workDefect(as(r), ownPool(r))],
    ['priv.assign', r => can.assignDefect(as(r))],
    ['priv.verify', r => can.verifyDefect(as(r), ownPool(r))],
    ['priv.audit', r => can.seeAudit(as(r))],
    ['priv.export', () => true],
    ['priv.reports', r => (settings.reportRecipientUids?.length ? users.some(u => u.role === r && settings.reportRecipientUids!.includes(u.id)) : r === 'manager' || r === 'admin')],
    ['priv.admin', r => can.manageSystem(as(r))],
  ];
  return (
    <Card title={t('priv.title')} className="mt">
      <p className="muted small">{t('priv.desc')}</p>
      <div className="table-wrap">
        <table className="priv">
          <thead><tr><th>{t('priv.what')}</th>{ROLES.map(r => <th key={r}>{t('role.' + r)}<small>{users.filter(u => u.active && u.role === r).length}</small></th>)}</tr></thead>
          <tbody>{rows.map(([k, f]) => (
            <tr key={k}><td>{t(k)}</td>{ROLES.map(r => <td key={r} className="c">{f(r) ? <Icon name="check" size={16} className="yes" /> : <span className="no">–</span>}</td>)}</tr>
          ))}</tbody>
        </table>
      </div>
      <p className="muted small mt">{t('priv.change')}</p>
    </Card>
  );
}
