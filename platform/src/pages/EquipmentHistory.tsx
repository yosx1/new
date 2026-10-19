import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { col } from '../lib/db';
import { OPEN_DEFECT, passRate } from '../lib/rules';
import { Badge, Card, DefectBadge, Empty, PageHead, SeverityBadge, Spinner, StatusBadge } from '../components/ui';
import { OwnerFiles, Thumb } from '../components/Attachments';
import { useUser } from '../auth/Auth';
import type { Defect, Inspection, ItemResult } from '../types';

export default function EquipmentHistory() {
  const { id = '' } = useParams();
  const { t, b, fmtDate } = useI18n();
  const data = useData();
  const user = useUser();
  const nav = useNavigate();
  const eq = data.eq(id);
  const [insps, setInsps] = useState<Inspection[] | null>(null);
  const [defs, setDefs] = useState<Defect[]>([]);
  const [measures, setMeasures] = useState<{ insp: Inspection; r: ItemResult; label: string }[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    let live = true;
    (async () => {
      const [a, d] = await Promise.all([
        getDocs(query(col('inspections'), where('equipmentId', '==', id), orderBy('createdAt', 'desc'), limit(50))),
        getDocs(query(col('defects'), where('equipmentId', '==', id), orderBy('reportedAt', 'desc'), limit(300))),
      ]);
      if (!live) return;
      const list = a.docs.map(x => ({ id: x.id, ...x.data() }) as Inspection);
      setInsps(list);
      setDefs(d.docs.map(x => ({ id: x.id, ...x.data() }) as Defect));
      // Measured values and evidence photos from the 5 most recent inspections.
      const m: { insp: Inspection; r: ItemResult; label: string }[] = [];
      const ph: string[] = [];
      for (const i of list.slice(0, 5)) {
        const rs = await getDocs(col(`inspections/${i.id}/results`));
        const labels = new Map(i.checklist.flatMap(s => s.items).map(it => [it.id, it.label]));
        for (const x of rs.docs) {
          const r = { id: x.id, ...x.data() } as ItemResult;
          if (r.value != null) m.push({ insp: i, r, label: b(labels.get(r.id)) });
          ph.push(...(r.photoIds ?? []));
        }
      }
      if (live) { setMeasures(m); setPhotos(ph.slice(0, 24)); }
    })().catch(e => { console.warn(e); setInsps([]); });
    return () => { live = false; };
  }, [id]); // eslint-disable-line

  const repeated = useMemo(() => {
    const g = new Map<string, Defect[]>();
    for (const d of defs) g.set(d.itemId, [...(g.get(d.itemId) ?? []), d]);
    return [...g.values()].filter(x => x.length > 1).sort((x, y) => y.length - x.length);
  }, [defs]);
  const byItem = useMemo(() => {
    const g = new Map<string, { label: string; unit?: string; points: { v: number; date: string; code: string }[] }>();
    for (const { insp, r, label } of measures) {
      const e = g.get(r.id) ?? { label, unit: r.unit, points: [] };
      e.points.push({ v: r.value!, date: insp.inspectionDate, code: insp.code });
      g.set(r.id, e);
    }
    return [...g.values()];
  }, [measures]);

  if (!eq) return <Card><Empty>{t('c.noResults')}</Empty></Card>;
  const parent = data.eq(eq.parentId);

  return (
    <>
      <PageHead back={() => nav(-1)} title={<><span className="mono">{eq.tag}</span> · {b(eq.name)}</>}
        sub={`${b(data.dept(eq.departmentId)?.name)} · ${eq.line ?? ''} · ${eq.category}`} />
      <div className="grid g2">
        <Card title={t('c.details')}>
          <dl className="dl">
            <dt>{t('insp.tag')}</dt><dd className="mono">{eq.tag}</dd>
            <dt>{t('insp.category')}</dt><dd>{eq.category}</dd>
            <dt>{t('eq.line')}</dt><dd>{eq.line || '—'}</dd>
            <dt>{t('eq.location')}</dt><dd>{eq.location || '—'}</dd>
            <dt>{t('eq.manufacturer')}</dt><dd>{[eq.manufacturer, eq.model].filter(Boolean).join(' · ') || '—'}</dd>
            <dt>{t('eq.parent')}</dt><dd>{parent ? <Link to={`/equipment/${parent.id}`}>{parent.tag}</Link> : '—'}</dd>
            <dt>{t('eq.templates')}</dt><dd>{eq.templateIds?.join(', ') || '—'}</dd>
            <dt>{t('c.status')}</dt><dd>{eq.active ? t('c.active') : t('c.inactive')}</dd>
          </dl>
          <h4 className="mt mb">{t('c.attachments')}</h4>
          <OwnerFiles ownerType="equipment" ownerId={eq.id} canAdd={user.role === 'admin'} />
        </Card>
        <Card title={t('eq.repeated')}>
          {repeated.length === 0 ? <Empty icon="check" /> : (
            <div className="list">{repeated.map(g => (
              <div key={g[0].itemId} className="lrow tone-border-purple">
                <div className="grow"><b>{b(g[0].itemLabel)}</b><div className="meta">{g.map(d => d.code).join(' · ')}</div></div>
                <Badge tone="purple">{g.length}×</Badge>
              </div>
            ))}</div>
          )}
        </Card>
      </div>

      <Card title={t('eq.prevInspections')} className="mt">
        {insps === null ? <Spinner /> : insps.length === 0 ? <Empty /> : (
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>{t('insp.id')}</th><th>{t('insp.idate')}</th><th>{t('insp.wo')}</th><th>{t('insp.passRate')}</th><th>{t('insp.requiredApprovals')}</th><th>{t('c.status')}</th></tr></thead>
            <tbody>{insps.map(i => (
              <tr key={i.id} className="click" onClick={() => nav(`/inspections/${i.id}`)}>
                <td className="mono">{i.code}</td><td className="ltr">{i.inspectionDate}</td><td>{i.workOrder}<div className="small muted">{i.maintenanceType}</div></td>
                <td>{passRate(i.summary)}% <span className="muted small">({i.summary.fail} {t('item.fail')})</span></td>
                <td className="small">{Object.entries(i.approvals).map(([k, a]) => `${t('disc.' + k)}: ${a?.byName ?? ''}`).join(' · ') || '—'}</td>
                <td><StatusBadge status={i.status} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>

      <div className="grid g2 mt">
        <Card title={`${t('nav.defects')} (${defs.filter(OPEN_DEFECT).length} ${t('ds.open')})`}>
          {defs.length === 0 ? <Empty icon="check" /> : <div className="list">{defs.slice(0, 30).map(d => (
            <Link key={d.id} to={`/defects/${d.id}`} className="lrow"><div className="grow"><b className="mono">{d.code}</b> · {b(d.itemLabel)}
              <div className="meta ellipsis">{d.description} · {fmtDate(d.reportedAt)}</div>{d.correctiveAction && <div className="meta ellipsis">{t('def.ca')}: {d.correctiveAction}</div>}</div>
              <SeverityBadge s={d.severity} /><DefectBadge s={d.status} /></Link>
          ))}</div>}
        </Card>
        <Card title={t('eq.measurements')}>
          {byItem.length === 0 ? <Empty /> : <div className="table-wrap"><table className="tbl">
            <thead><tr><th>{t('c.name')}</th><th>{t('it.measured')}</th></tr></thead>
            <tbody>{byItem.map(m => (
              <tr key={m.label}><td>{m.label}</td><td className="ltr small">{m.points.map(p => `${p.date}: ${p.v} ${m.unit ?? ''}`).join(' | ')}</td></tr>
            ))}</tbody></table></div>}
        </Card>
      </div>
      {photos.length > 0 && <Card title={t('c.photos')} className="mt"><div className="photos">{photos.map(p => <Thumb key={p} id={p} />)}</div></Card>}
    </>
  );
}
