import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getDoc, getDocs, query, where } from 'firebase/firestore';
import { useI18n } from '../i18n/I18n';
import { useData } from '../data/DataProvider';
import { col, ref } from '../lib/db';
import { loadAttachment } from '../lib/files';
import { approvalBlockers, passRate } from '../lib/rules';
import { Spinner } from '../components/ui';
import type { Attachment, Defect, Inspection, ItemResult } from '../types';
import './print.css';

/** Printable A4 inspection report. "Save as PDF" in the print dialog produces the PDF on any device. */
export default function InspectionPrint() {
  const { id = '' } = useParams();
  const { t, b, fmtDate, lang } = useI18n();
  const data = useData();
  const [insp, setInsp] = useState<Inspection | null>(null);
  const [results, setResults] = useState<Record<string, ItemResult>>({});
  const [defects, setDefects] = useState<Defect[]>([]);
  const [photos, setPhotos] = useState<Record<string, Attachment>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await getDoc(ref('inspections', id));
      if (!s.exists()) return;
      const i = { id: s.id, ...s.data() } as Inspection;
      const [rs, ds] = await Promise.all([
        getDocs(col(`inspections/${id}/results`)),
        getDocs(query(col('defects'), where('inspectionId', '==', id))),
      ]);
      const res = Object.fromEntries(rs.docs.map(d => [d.id, { id: d.id, ...d.data() } as ItemResult]));
      const defs = ds.docs.map(d => ({ id: d.id, ...d.data() }) as Defect);
      const ids = [...Object.values(res).flatMap(r => r.photoIds ?? []), ...defs.flatMap(d => d.photoIds ?? [])].slice(0, 40);
      const atts = await Promise.all(ids.map(loadAttachment));
      setInsp(i); setResults(res); setDefects(defs);
      setPhotos(Object.fromEntries(atts.filter((a): a is Attachment => !!a && a.mime.startsWith('image/')).map(a => [a.id, a])));
      setReady(true);
    })();
  }, [id]);

  if (!ready || !insp) return <div className="center-screen"><Spinner /></div>;
  const s = insp.summary;
  const blockers = approvalBlockers(insp);
  const generated = new Date();

  return (
    <div className="report" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="no-print toolbar">
        <button className="btn primary" onClick={() => window.print()}>{t('c.print')}</button>
        <button className="btn ghost" onClick={() => window.close()}>{t('c.close')}</button>
      </div>

      <header className="r-head">
        <img src="/icon.svg" alt="" width={46} height={46} />
        <div className="grow">
          <h1>{t('rep.inspection')} — Cold Run</h1>
          <p>{insp.plantName} · {b(data.dept(insp.departmentId)?.name)}</p>
        </div>
        <div className="r-id"><b className="mono">{insp.code}</b><span>{t(`st.${insp.status}`)}</span></div>
      </header>

      <table className="r-grid">
        <tbody>
          <tr><th>{t('c.equipment')}</th><td>{insp.equipmentTag} – {b(insp.equipmentName)}</td><th>{t('insp.category')}</th><td>{insp.equipmentCategory}</td></tr>
          <tr><th>{t('insp.wo')}</th><td>{insp.workOrder}</td><th>{t('insp.mtype')}</th><td>{insp.maintenanceType}</td></tr>
          <tr><th>{t('insp.mdate')}</th><td>{insp.maintenanceCompletedAt}</td><th>{t('insp.idate')}</th><td>{insp.inspectionDate} · {insp.shift}</td></tr>
          <tr><th>{t('insp.supervisor')}</th><td>{data.userName(insp.supervisorUid)}</td><th>{t('insp.template')}</th><td>{insp.templateCode} v{insp.templateVersion}</td></tr>
          <tr><th>{t('insp.prodEng')}</th><td>{data.userName(insp.productionEngUid)}</td><th>{t('insp.maintEng')}</th><td>{data.userName(insp.maintenanceEngUid)}</td></tr>
        </tbody>
      </table>

      <div className="r-stats">
        <span>{t('c.total')}: <b>{s.total}</b></span><span className="g">{t('item.pass')}: <b>{s.pass}</b></span>
        <span className="r">{t('item.fail')}: <b>{s.fail}</b></span><span className="o">{t('item.pending')}: <b>{s.pending}</b></span>
        <span>{t('item.na')}: <b>{s.na}</b></span><span>{t('insp.passRate')}: <b>{passRate(s)}%</b></span>
        <span className="r">{t('block.openDefects')}: <b>{s.openDefects}</b></span>
      </div>

      {insp.checklist.map(sec => (
        <section key={sec.id} className="r-sec">
          <h2>{b(sec.title)} <small>· {t('disc.' + sec.discipline)}</small></h2>
          <table className="r-tbl">
            <thead><tr><th>#</th><th>{t('it.result')}</th><th>{t('c.status')}</th><th>{t('it.measured')}</th><th>{t('it.limits')}</th><th>{t('c.comment')}</th><th>{t('it.inspector')}</th></tr></thead>
            <tbody>
              {sec.items.map((it, k) => {
                const r = results[it.id];
                const st = r?.status ?? 'pending';
                return (
                  <tr key={it.id} className={'st-' + st}>
                    <td>{k + 1}</td>
                    <td>{b(it.label)}{it.critical && <b className="crit"> ●</b>}{it.procedureRef && <div className="ref">{it.procedureRef}</div>}</td>
                    <td className="st">{t('item.' + st)}</td>
                    <td className="ltr">{r?.value != null ? `${r.value} ${r.unit ?? ''}` : ''}</td>
                    <td className="ltr">{it.measure ? `${it.measure.min ?? '–'} … ${it.measure.max ?? '–'} ${it.measure.unit}` : ''}</td>
                    <td>{r?.comment}{r?.naReason && ` (${r.naReason})`}{r?.supervisorComment && <div className="ref">{t('it.supervisorComment')}: {r.supervisorComment}</div>}</td>
                    <td>{r ? <>{r.inspectorName}<div className="ref">{fmtDate(r.at, true)}</div></> : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}

      {defects.length > 0 && (
        <section className="r-sec">
          <h2>{t('def.title')}</h2>
          <table className="r-tbl">
            <thead><tr><th>{t('def.id')}</th><th>{t('def.desc')}</th><th>{t('def.severity')}</th><th>{t('def.ca')}</th><th>{t('c.status')}</th><th>{t('def.verify')}</th></tr></thead>
            <tbody>{defects.map(d => (
              <tr key={d.id}><td className="mono">{d.code}</td><td>{b(d.itemLabel)}: {d.description}</td><td>{t('sev.' + d.severity)}</td>
                <td>{d.correctiveAction}{d.repair && <div className="ref">{d.repair.byName} · {fmtDate(d.repair.at)}</div>}</td><td>{t('ds.' + d.status)}</td>
                <td>{d.verification ? `${t('item.' + d.verification.result)} · ${d.verification.byName} · ${fmtDate(d.verification.at)}` : ''}</td></tr>
            ))}</tbody>
          </table>
        </section>
      )}

      {Object.keys(photos).length > 0 && (
        <section className="r-sec">
          <h2>{t('c.photos')}</h2>
          <div className="r-photos">{Object.values(photos).map(p => <figure key={p.id}><img src={p.data} alt="" /><figcaption>{p.name}</figcaption></figure>)}</div>
        </section>
      )}

      <section className="r-sec">
        <h2>{t('insp.requiredApprovals')}</h2>
        <table className="r-tbl">
          <thead><tr><th>{t('c.discipline')}</th><th>{t('c.status')}</th><th>{t('c.by')}</th><th>{t('c.date')}</th><th>{t('c.comment')}</th><th>{t('rep.signatures')}</th></tr></thead>
          <tbody>{[...insp.requiredApprovals, 'final' as const].map(k => {
            const a = insp.approvals[k];
            return <tr key={k}><td>{t('disc.' + k)}</td><td>{a ? (a.decision === 'approved' ? t('insp.approve') : t('insp.reject')) : t('item.pending')}</td>
              <td>{a?.byName}</td><td>{fmtDate(a?.at ?? null, true)}</td><td>{a?.comment}</td><td className="sign" /></tr>;
          })}</tbody>
        </table>
        {insp.override && <p className="warn">{t('insp.override')}: {insp.override.justification} — {insp.override.byName} · {fmtDate(insp.override.at, true)}</p>}
        {blockers.length > 0 && <p className="warn">{t('insp.blockers')}: {blockers.map(x => `${t(x.key)} (${x.n})`).join(' · ')}</p>}
        <p className="final">{t('c.status')}: <b>{t('st.' + insp.status)}</b></p>
        <p className="safety">{t('insp.safety')}</p>
      </section>

      <footer className="r-foot">
        <span>{insp.code} · {t('rep.docVersion')} {insp.docVersion} · {t('insp.template')} {insp.templateCode} v{insp.templateVersion}</span>
        <span>{t('rep.generated')}: {fmtDate(generated, true)}</span>
      </footer>
    </div>
  );
}
