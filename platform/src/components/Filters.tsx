import { useI18n } from '../i18n/I18n';
import { useData } from '../data/DataProvider';
import { DISCIPLINES, type Inspection, type InspectionStatus } from '../types';
import { Icon } from './Icon';

export interface FilterState { q: string; dept: string; eq: string; status: string; disc: string; shutdown: string }
export const EMPTY_FILTERS: FilterState = { q: '', dept: '', eq: '', status: '', disc: '', shutdown: '' };
const STATUSES: InspectionStatus[] = ['pool', 'corrective', 'waiting_approval', 'approved', 'archived'];

export function applyFilters(list: Inspection[], f: FilterState) {
  const q = f.q.trim().toLowerCase();
  return list.filter(i => (!f.dept || i.departmentId === f.dept) && (!f.eq || i.equipmentId === f.eq) && (!f.status || i.status === f.status)
    && (!f.disc || i.discipline === f.disc) && (!f.shutdown || i.shutdownId === f.shutdown)
    && (!q || `${i.code} ${i.title}`.toLowerCase().includes(q)));
}

export function Filters({ value, onChange, show = ['q', 'dept', 'eq', 'status', 'disc'] }: {
  value: FilterState; onChange: (v: FilterState) => void; show?: (keyof FilterState)[];
}) {
  const { t, b } = useI18n();
  const { departments, equipment, shutdowns } = useData();
  const set = (k: keyof FilterState, v: string) => onChange({ ...value, [k]: v, ...(k === 'dept' ? { eq: '' } : {}) });
  const has = (k: keyof FilterState) => show.includes(k);
  const active = Object.entries(value).some(([k, v]) => k !== 'q' && v);
  return (
    <div className="filters">
      {has('q') && <div className="search" style={{ gridColumn: 'span 2' }}><Icon name="search" size={18} />
        <input type="search" placeholder={t('c.search')} value={value.q} onChange={e => set('q', e.target.value)} /></div>}
      {has('shutdown') && <select value={value.shutdown} onChange={e => set('shutdown', e.target.value)} aria-label={t('sd.title')}>
        <option value="">{t('sd.title')}: {t('c.all')}</option>
        {shutdowns.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>}
      {has('dept') && <select value={value.dept} onChange={e => set('dept', e.target.value)} aria-label={t('c.department')}>
        <option value="">{t('c.department')}: {t('c.all')}</option>
        {departments.map(d => <option key={d.id} value={d.id}>{b(d.name)}</option>)}
      </select>}
      {has('eq') && <select value={value.eq} onChange={e => set('eq', e.target.value)} aria-label={t('c.equipment')}>
        <option value="">{t('c.equipment')}: {t('c.all')}</option>
        {equipment.filter(e => !value.dept || e.departmentId === value.dept).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>}
      {has('status') && <select value={value.status} onChange={e => set('status', e.target.value)} aria-label={t('c.status')}>
        <option value="">{t('c.status')}: {t('c.all')}</option>
        {STATUSES.map(s => <option key={s} value={s}>{t('st.' + s)}</option>)}
      </select>}
      {has('disc') && <select value={value.disc} onChange={e => set('disc', e.target.value)} aria-label={t('c.discipline')}>
        <option value="">{t('c.discipline')}: {t('c.all')}</option>
        {DISCIPLINES.map(d => <option key={d} value={d}>{t('disc.' + d)}</option>)}
      </select>}
      {active && <button className="btn ghost" onClick={() => onChange({ ...EMPTY_FILTERS, q: value.q })}><Icon name="x" size={16} />{t('c.reset')}</button>}
    </div>
  );
}
