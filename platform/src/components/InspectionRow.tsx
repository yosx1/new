import { Link } from 'react-router-dom';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { completion } from '../lib/rules';
import { Progress, StatusBadge } from './ui';
import type { Inspection } from '../types';

export function InspectionRow({ i }: { i: Inspection }) {
  const { t, b } = useI18n();
  const data = useData();
  const s = i.summary;
  return (
    <Link to={`/inspections/${i.id}`} className="lrow">
      <div className="grow">
        <b>{i.title}</b> · <span className="muted">{t('disc.' + i.discipline)}</span>
        <div className="meta ellipsis">{b(data.dept(i.departmentId)?.name)} · <span className="mono">{i.code}</span> · {i.createdByName}
          {s.notok > s.fixed ? ` · ${s.notok - s.fixed} ${t('part.notok')}` : ''}</div>
        {i.status === 'pool' && <Progress value={completion(s)} tone={s.notok ? 'red' : 'green'} />}
      </div>
      <StatusBadge status={i.status} />
    </Link>
  );
}
