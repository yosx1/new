import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { serverTimestamp } from 'firebase/firestore';
import { addDoc, updateDoc, writeBatch } from '../lib/fs';
import { db } from '../firebase';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { useUser } from '../auth/Auth';
import { audit, col, ref } from '../lib/db';
import { can } from '../lib/rules';
import { downloadText } from '../lib/files';
import { equipmentToCsv, planCsvImport, type CsvPlan } from '../lib/equipmentCsv';
import { Badge, Card, Empty, Field, Modal, PageHead, errMsg, useFeedback } from '../components/ui';
import { Tip } from '../components/Tips';
import { Icon } from '../components/Icon';
import { DISCIPLINES, type Discipline, type Equipment } from '../types';

type Form = { id?: string; name: string; departmentId: string; parts: Record<Discipline, string> };
const lines = (s: string) => [...new Set(s.split('\n').map(x => x.trim()).filter(Boolean))];

export default function EquipmentPage() {
  const { t, b } = useI18n();
  const user = useUser();
  const data = useData();
  const { toast, confirm } = useFeedback();
  const manage = can.manageEquipment(user);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [form, setForm] = useState<Form | null>(null);
  const [plan, setPlan] = useState<CsvPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => data.equipment.filter(e => e.active && (!dept || e.departmentId === dept)
    && (!q || e.name.toLowerCase().includes(q.toLowerCase()))), [data.equipment, dept, q]);

  const download = () => downloadText(`equipment-${new Date().toISOString().slice(0, 10)}.csv`, equipmentToCsv(data.equipment, data.departments));
  const pick = async (f?: File) => {
    if (!f) return;
    setPlan(planCsvImport(await f.text(), data.equipment.filter(e => e.active), data.departments));
    if (file.current) file.current.value = '';
  };
  const doImport = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      for (let k = 0; k < plan.items.length; k += 400) {
        const batch = writeBatch(db);
        for (const it of plan.items.slice(k, k + 400)) {
          const body = { name: it.name, departmentId: it.departmentId, parts: it.parts, active: true, updatedAt: serverTimestamp() };
          if (it.id) batch.update(ref('equipment', it.id), body); else batch.set(ref('equipment', crypto.randomUUID().replace(/-/g, '').slice(0, 20)), body);
        }
        await batch.commit();
      }
      audit(user, 'equipment.import', 'equipment', 'csv', { note: `${plan.added} new, ${plan.updated} updated, ${plan.parts} parts` });
      toast(t('eq.imported', { a: plan.added, u: plan.updated }));
      setPlan(null);
    } catch (e) { toast(errMsg(e, t), 'err'); } finally { setBusy(false); }
  };

  const open = (e?: Equipment) => setForm(e
    ? { id: e.id, name: e.name, departmentId: e.departmentId, parts: Object.fromEntries(DISCIPLINES.map(d => [d, (e.parts?.[d] ?? []).join('\n')])) as Form['parts'] }
    : { name: '', departmentId: dept || data.departments[0]?.id || '', parts: { mechanical: '', electrical: '', instrumentation: '', production: '' } });
  const save = async () => {
    if (!form) return;
    const name = form.name.trim();
    if (!name || !form.departmentId) { toast(t('c.required'), 'err'); return; }
    if (data.equipment.some(e => e.active && e.id !== form.id && e.departmentId === form.departmentId && e.name.toLowerCase() === name.toLowerCase())) { toast(t('eq.duplicate'), 'err'); return; }
    const body = { name, departmentId: form.departmentId, parts: Object.fromEntries(DISCIPLINES.map(d => [d, lines(form.parts[d])])), active: true, updatedAt: serverTimestamp() };
    setBusy(true);
    try {
      if (form.id) await updateDoc(ref('equipment', form.id), body); else await addDoc(col('equipment'), body);
      audit(user, form.id ? 'equipment.edit' : 'equipment.add', 'equipment', form.id ?? name, { label: name });
      setForm(null);
    } catch (e) { toast(errMsg(e, t), 'err'); } finally { setBusy(false); }
  };
  const remove = async (e: Equipment) => {
    if (!(await confirm(t('eq.remove'), e.name, true))) return;
    try { await updateDoc(ref('equipment', e.id), { active: false, updatedAt: serverTimestamp() }); audit(user, 'equipment.remove', 'equipment', e.id, { label: e.name }); }
    catch (err) { toast(errMsg(err, t), 'err'); }
  };

  return (
    <>
      <PageHead title={t('eq.title')} sub={`${data.equipment.filter(e => e.active).length} ${t('eq.count')}`} actions={manage && <>
        <button className="btn ghost" onClick={download}><Icon name="download" />{t('eq.csvDownload')}</button>
        <button className="btn ghost" onClick={() => file.current?.click()}><Icon name="file" />{t('eq.csvUpload')}</button>
        <button className="btn primary" onClick={() => open()}><Icon name="plus" />{t('eq.add')}</button>
        <input ref={file} type="file" hidden accept=".csv,text/csv" onChange={e => pick(e.target.files?.[0])} />
      </>} />
      {manage && <Tip id="equipment">{t('tip.equipment')}</Tip>}
      <div className="filters">
        <div className="search" style={{ gridColumn: 'span 2' }}><Icon name="search" size={18} /><input type="search" placeholder={t('c.search')} value={q} onChange={e => setQ(e.target.value)} /></div>
        <select value={dept} onChange={e => setDept(e.target.value)}><option value="">{t('c.department')}: {t('c.all')}</option>
          {data.departments.map(d => <option key={d.id} value={d.id}>{b(d.name)}</option>)}</select>
      </div>

      {data.departments.filter(d => !dept || d.id === dept).map(d => {
        const list = rows.filter(e => e.departmentId === d.id);
        if (!list.length && q) return null;
        return (
          <Card key={d.id} title={<>{b(d.name)} <Badge tone="blue">{list.length}</Badge></>} className="mb">
            {list.length === 0 ? <Empty>{manage ? t('eq.emptyManage') : t('eq.empty')}</Empty> : (
              <div className="list">
                {list.map(e => (
                  <div key={e.id} className="lrow">
                    <Link to={`/equipment/${e.id}`} className="grow" style={{ color: 'inherit' }}>
                      <b>{e.name}</b>
                      <div className="chips mt-xs">{DISCIPLINES.filter(x => e.parts?.[x]?.length).map(x => <span key={x} className="badge tone-gray">{t('disc.' + x)} · {e.parts[x].length}</span>)}
                        {!DISCIPLINES.some(x => e.parts?.[x]?.length) && <span className="badge tone-orange">{t('eq.noParts')}</span>}</div>
                    </Link>
                    {manage && <>
                      <button className="btn sm ghost" onClick={() => open(e)} aria-label={t('c.edit')}><Icon name="edit" size={15} /></button>
                      <button className="btn sm ghost" onClick={() => remove(e)} aria-label={t('eq.remove')}><Icon name="trash" size={15} /></button>
                    </>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}

      {form && (
        <Modal title={form.id ? t('c.edit') : t('eq.add')} wide onClose={() => setForm(null)} footer={<>
          <button className="btn ghost" onClick={() => setForm(null)}>{t('c.cancel')}</button>
          <button className="btn primary" disabled={busy} onClick={save}>{t('c.save')}</button></>}>
          <div className="grid g2">
            <Field label={t('eq.name')} required><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label={t('c.department')} required><select value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })}>
              {data.departments.map(d => <option key={d.id} value={d.id}>{b(d.name)}</option>)}</select></Field>
          </div>
          <div className="grid g2">
            {DISCIPLINES.map(d => (
              <Field key={d} label={`${t('eq.partsOf')} ${t('disc.' + d)} (${lines(form.parts[d]).length})`} hint={t('eq.onePerLine')}>
                <textarea rows={4} value={form.parts[d]} onChange={e => setForm({ ...form, parts: { ...form.parts, [d]: e.target.value } })} />
              </Field>
            ))}
          </div>
        </Modal>
      )}

      {plan && (
        <Modal title={t('eq.csvUpload')} wide onClose={() => setPlan(null)} footer={<>
          <button className="btn ghost" onClick={() => setPlan(null)}>{t('c.cancel')}</button>
          <button className="btn primary" disabled={busy || !plan.items.length} onClick={doImport}>{t('eq.import')}</button></>}>
          <p>{t('eq.preview', { a: plan.added, u: plan.updated, p: plan.parts })}</p>
          <p className="muted small">{t('eq.previewNote')}</p>
          {plan.items.length > 0 && (
            <div className="table-wrap"><table className="tbl">
              <thead><tr><th>{t('c.department')}</th><th>{t('c.equipment')}</th>{DISCIPLINES.map(d => <th key={d}>{t('disc.' + d)}</th>)}<th /></tr></thead>
              <tbody>{plan.items.slice(0, 200).map((it, k) => (
                <tr key={k}><td>{b(data.dept(it.departmentId)?.name)}</td><td><b>{it.name}</b></td>
                  {DISCIPLINES.map(d => <td key={d}>{it.parts[d].length}</td>)}
                  <td>{it.id ? <Badge tone="blue">{t('eq.update')}</Badge> : <Badge tone="green">{t('eq.new')}</Badge>}</td></tr>
              ))}</tbody>
            </table></div>
          )}
          {plan.errors.length > 0 && (
            <div className="alert warn mt">
              <b>{t('eq.csvErrors', { n: plan.errors.length })}</b>
              <ul className="small">{plan.errors.slice(0, 20).map(x => <li key={x.line}>{t('eq.line')} {x.line}: {t('eq.err.' + x.reason, { list: data.departments.map(d => b(d.name)).join(', ') })} — <span className="ltr">{x.text}</span></li>)}</ul>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
