import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAllInspections, useData } from '../data/DataProvider';
import { equipmentTitle } from '../lib/rules';
import { useI18n } from '../i18n/I18n';
import { Card, Empty, PageHead } from '../components/ui';
import { InspectionRow } from '../components/InspectionRow';
import { DISCIPLINES } from '../types';

/** One piece of equipment: its parts per discipline and every inspection of it, across shutdowns. */
export default function EquipmentHistory() {
  const { id = '' } = useParams();
  const { t, b } = useI18n();
  const data = useData();
  const nav = useNavigate();
  const eq = data.eq(id);
  const all = useAllInspections();
  const insps = useMemo(() => all.filter(i => i.equipmentId === id), [all, id]);
  if (!eq) return <Card><Empty>{t('c.notFound')}</Empty></Card>;

  return (
    <>
      <PageHead back={() => nav(-1)} title={equipmentTitle(eq)} sub={b(data.dept(eq.departmentId)?.name)} />
      <div className="grid g2">
        {DISCIPLINES.map(d => (
          <Card key={d} title={`${t('disc.' + d)} · ${eq.parts?.[d]?.length ?? 0}`}>
            {eq.parts?.[d]?.length ? <ol className="part-preview">{eq.parts[d].map((p, k) => <li key={k}>{p}</li>)}</ol> : <p className="muted">{t('eq.noPartsHere')}</p>}
          </Card>
        ))}
      </div>
      <Card title={t('eq.history')} className="mt">
        {insps.length === 0 ? <Empty /> : <div className="list">{insps.map(i => <InspectionRow key={i.id} i={i} />)}</div>}
      </Card>
    </>
  );
}
