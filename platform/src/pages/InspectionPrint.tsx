import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getDoc } from '../lib/fs';
import { useI18n } from '../i18n/I18n';
import { useData } from '../data/DataProvider';
import { ref } from '../lib/db';
import { loadAttachment } from '../lib/files';
import { Spinner } from '../components/ui';
import type { Attachment, Inspection } from '../types';
import './print.css';

/** Printable A4 inspection report. "Save as PDF" in the print dialog produces the PDF on any device. */
export default function InspectionPrint() {
  const { id = '' } = useParams();
  const { t, b, fmtDate, lang } = useI18n();
  const data = useData();
  const [insp, setInsp] = useState<Inspection | null>(null);
  const [photos, setPhotos] = useState<Attachment[]>([]);

  useEffect(() => {
    (async () => {
      const s = await getDoc(ref('inspections', id));
      if (!s.exists()) return;
      const i = { id: s.id, ...s.data() } as Inspection;
      setInsp(i);
      const ids = Object.values(i.results ?? {}).flatMap(r => [...(r.photoIds ?? []), ...(r.fix?.photoIds ?? [])]);
      setPhotos((await Promise.all(ids.slice(0, 24).map(loadAttachment))).filter((x): x is Attachment => !!x && x.mime.startsWith('image/')));
    })();
  }, [id]);

  if (!insp || !data.loaded) return <div className="center-screen"><Spinner /></div>;
  const s = insp.summary;

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
          <p>{b(data.settings.plantName)} · {insp.shutdownName}</p>
        </div>
        <div className="r-id"><b className="mono">{insp.code}</b><span>{t(`st.${insp.status}`)}</span></div>
      </header>

      <table className="r-grid">
        <tbody>
          <tr><th>{t('c.equipment')}</th><td>{insp.title}</td><th>{t('c.department')}</th><td>{b(data.dept(insp.departmentId)?.name)}</td></tr>
          <tr><th>{t('c.discipline')}</th><td>{t('disc.' + insp.discipline)}</td><th>{t('insp.by')}</th><td>{insp.createdByName} · {fmtDate(insp.createdAt)}</td></tr>
        </tbody>
      </table>

      <div className="r-stats">
        <span>{t('insp.parts')}: <b>{s.total}</b></span><span className="g">{t('part.ok')}: <b>{s.ok}</b></span>
        <span className="r">{t('part.notok')}: <b>{s.notok}</b></span><span>{t('part.fixed')}: <b>{s.fixed}</b></span>
        <span className="o">{t('part.pending')}: <b>{s.pending}</b></span>
      </div>

      <section className="r-sec">
        <h2>{t('insp.parts')} · {t('disc.' + insp.discipline)}</h2>
        <table className="r-tbl">
          <thead><tr><th>#</th><th>{t('insp.part')}</th><th>{t('c.status')}</th><th>{t('insp.problem')}</th><th>{t('insp.fixNote')}</th><th>{t('insp.checkedBy')}</th></tr></thead>
          <tbody>{insp.parts.map((p, k) => {
            const r = insp.results[p.id];
            const st = r?.status ?? 'pending';
            return (
              <tr key={p.id} className={'st-' + (st === 'ok' ? 'pass' : st === 'notok' ? 'fail' : 'pending')}>
                <td>{k + 1}</td><td>{p.name}</td><td className="st">{r?.fix ? t('part.fixed') : t('part.' + st)}</td>
                <td>{st === 'notok' ? r?.note : ''}</td>
                <td>{r?.fix ? <>{r.fix.note}<div className="ref">{r.fix.byName} · {fmtDate(r.fix.at, true)}</div></> : ''}</td>
                <td>{r && st !== 'pending' ? <>{r.byName}<div className="ref">{fmtDate(r.at, true)}</div></> : ''}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </section>

      {photos.length > 0 && (
        <section className="r-sec">
          <h2>{t('c.photos')}</h2>
          <div className="r-photos">{photos.map(p => <figure key={p.id}><img src={p.data} alt="" /><figcaption>{p.name}</figcaption></figure>)}</div>
        </section>
      )}

      <section className="r-sec">
        <h2>{t('insp.approval')}</h2>
        <table className="r-tbl">
          <thead><tr><th>{t('c.status')}</th><th>{t('c.by')}</th><th>{t('c.date')}</th><th>{t('c.comment')}</th><th>{t('rep.signatures')}</th></tr></thead>
          <tbody><tr>
            <td>{insp.approval ? t('st.approved') : t('st.' + insp.status)}</td><td>{insp.approval?.byName}</td>
            <td>{fmtDate(insp.approval?.at ?? null, true)}</td><td>{insp.approval?.comment}</td><td className="sign" />
          </tr></tbody>
        </table>
        <p className="safety">{t('insp.safety')}</p>
      </section>

      <footer className="r-foot">
        <span>{insp.code} · {t('rep.docVersion')} {insp.docVersion}</span>
        <span>{t('rep.generated')}: {fmtDate(new Date(), true)}</span>
      </footer>
    </div>
  );
}
