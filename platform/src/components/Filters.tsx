import { useI18n } from '../i18n/I18n';
import { useData } from '../data/DataProvider';
import { DISCIPLINES, type InspectionStatus } from '../types';
import { Icon } from './Icon';

export interface FilterState {
  q: string; dept: string; eq: string; from: string; to: string; status: string; disc: string;
}
export const EMPTY_FILTERS: FilterState = { q: '', dept: '', eq: '', from: '', to: '', status: '', disc: '' };

const STATUSES: InspectionStatus[] = ['draft', 'maintenance_completed', 'in_progress', 'failed_ca', 'awaiting_verification',
  'awaiting_dept_approval', 'ready_for_review', 'approved', 'rejected'];

export function Filters({ value, onChange, show = ['q', 'dept', 'eq', 'from', 'to', 'status', 'disc'], statuses }: {
  value: FilterState; onChange: (v: FilterState) => void; show?: (keyof FilterState)[]; statuses?: [string, string][];
}) {
  const { t, b } = useI18n();
  const { departments, equipment } = useData();
  const set = (k: keyof FilterState, v: string) => onChange({ ...value, [k]: v, ...(k === 'dept' ? { eq: '' } : {}) });
  const has = (k: keyof FilterState) => show.includes(k);
  const active = Object.entries(value).some(([k, v]) => k !== 'q' && v);
  return (
    <div className="filters">
      {has('q') && <div className="search" style={{ gridColumn: 'span 2' }}><Icon name="search" size={18} />
        <input type="search" placeholder={t('c.search')} value={value.q} onChange={e => set('q', e.target.value)} /></div>}
      {has('dept') && <select value={value.dept} onChange={e => set('dept', e.target.value)} aria-label={t('c.department')}>
        <option value="">{t('c.department')}: {t('c.all')}</option>
        {departments.map(d => <option key={d.id} value={d.id}>{b(d.name)}</option>)}
      </select>}
      {has('eq') && <select value={value.eq} onChange={e => set('eq', e.target.value)} aria-label={t('c.equipment')}>
        <option value="">{t('c.equipment')}: {t('c.all')}</option>
        {equipment.filter(e => !value.dept || e.departmentId === value.dept).map(e => <option key={e.id} value={e.id}>{e.tag} – {b(e.name)}</option>)}
      </select>}
      {has('status') && <select value={value.status} onChange={e => set('status', e.target.value)} aria-label={t('c.status')}>
        <option value="">{t('c.status')}: {t('c.all')}</option>
        {(statuses ?? STATUSES.map(s => [s, t('st.' + s)] as [string, string])).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>}
      {has('disc') && <select value={value.disc} onChange={e => set('disc', e.target.value)} aria-label={t('c.discipline')}>
        <option value="">{t('c.discipline')}: {t('c.all')}</option>
        {DISCIPLINES.map(d => <option key={d} value={d}>{t('disc.' + d)}</option>)}
      </select>}
      {has('from') && <label className="date-f"><span>{t('c.from')}</span><input type="date" value={value.from} onChange={e => set('from', e.target.value)} /></label>}
      {has('to') && <label className="date-f"><span>{t('c.to')}</span><input type="date" value={value.to} onChange={e => set('to', e.target.value)} /></label>}
      {active && <button className="btn ghost" onClick={() => onChange({ ...EMPTY_FILTERS, q: value.q })}><Icon name="x" size={16} />{t('c.reset')}</button>}
    </div>
  );
}
