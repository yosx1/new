import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { useUser } from '../auth/Auth';
import { createInspection } from '../lib/actions';
import { can, equipmentTitle, inspectionId, matchesEquipment } from '../lib/rules';
import { Card, Field, PageHead, errMsg, useFeedback } from '../components/ui';
import { Tip } from '../components/Tips';
import { Icon } from '../components/Icon';
import type { Discipline } from '../types';

const MAX_ITEMS = 150;
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, k) => x === b[k]);

export default function NewInspection() {
  const { t, b } = useI18n();
  const user = useUser();
  const data = useData();
  const nav = useNavigate();
  const { toast } = useFeedback();
  const member = user.role === 'member';
  const [dept, setDept] = useState(member && user.departmentId ? user.departmentId : '');
  const [q, setQ] = useState('');
  // ?eq=<equipment id>&d=<discipline> preselects (from "Adjust checklist" in Waiting in your pool)
  const [params] = useSearchParams();
  const [eqId, setEqId] = useState(params.get('eq') ?? '');
  const [disc, setDisc] = useState<Discipline | ''>(member && user.discipline ? user.discipline : (params.get('d') as Discipline | null) ?? '');
  const [items, setItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');
  const [busy, setBusy] = useState(false);
  const sd = data.shutdown;

  // everything this person may start, in code order
  const allowed = useMemo(() => data.equipment.filter(e => e.active && (!dept || e.departmentId === dept) && can.disciplinesFor(user, e).length),
    [data.equipment, dept, user]);
  const found = useMemo(() => (q.trim() ? allowed.filter(e => matchesEquipment(e, q)).slice(0, 40) : []), [allowed, q]);
  const eq = data.eq(eqId);
  const discs = eq ? can.disciplinesFor(user, eq) : [];
  const d: Discipline | '' = disc && discs.includes(disc) ? disc : discs.length === 1 ? discs[0] : '';
  const standard = useMemo(() => (eq && d ? eq.parts[d] ?? [] : []), [eq, d]);
  const exists = !!(sd && eq && d && data.inspections.some(i => i.id === inspectionId(sd.id, eq.id, d)));
  const adjusted = !same(items, standard);

  // a new equipment or discipline starts from its standard checklist
  const pick = `${eqId}|${d}`;
  useEffect(() => { setItems(standard); setNewItem(''); }, [pick]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (id: string) => { setEqId(id); setQ(''); };
  const add = () => {
    const v = newItem.trim().replace(/\s+/g, ' ');
    if (!v) return;
    if (items.some(x => x.toLowerCase() === v.toLowerCase())) { toast(t('insp.itemExists'), 'err'); return; }
    if (items.length >= MAX_ITEMS) { toast(t('insp.tooManyItems', { n: MAX_ITEMS }), 'err'); return; }
    setItems([...items, v]); setNewItem('');
  };
  const create = async () => {
    if (!sd || !eq || !d) return;
    if (!exists && !items.length) { toast(t('insp.noItems'), 'err'); return; }
    setBusy(true);
    try {
      const id = await createInspection(user, sd, eq, d, exists ? undefined : items);
      toast(exists ? t('insp.exists') : t('insp.created'));
      nav(`/inspections/${id}`, { replace: true });
    } catch (e) { toast(errMsg(e, t), 'err'); setBusy(false); }
  };

  return (
    <>
      <PageHead title={t('nav.new')} back={() => nav(-1)} sub={sd?.name} />
      <Tip id="newInsp">{t('tip.newInsp')}</Tip>
      {!sd ? <Card><p className="muted">{t('sd.none')}</p></Card> : (
        <Card>
          {/* find the equipment by its code, its name or a checklist item */}
          <Field label={t('insp.findEq')} hint={t('insp.findEqHint', { n: allowed.length })}>
            <div className="search"><Icon name="search" size={18} />
              <input type="search" className="find-eq" value={q} onChange={e => setQ(e.target.value)} placeholder={t('insp.findEqPh')} autoComplete="off" />
            </div>
          </Field>
          {q.trim() && (
            <div className="list eq-results mb">
              {found.length === 0 ? <p className="muted small">{t('insp.noMatch')}</p> : found.map(e => {
                const s = q.trim().toLowerCase();
                const hit = matchesEquipment(e, q, false) ? '' : Object.values(e.parts ?? {}).flat().find(p => p.toLowerCase().includes(s));
                return (
                  <button type="button" key={e.id} className="lrow eq-hit" onClick={() => choose(e.id)}>
                    <div className="grow">
                      {e.code && <span className="mono eq-code">{e.code}</span>} <b>{e.name}</b>
                      <div className="meta">{b(data.dept(e.departmentId)?.name)}{hit ? <> · {t('insp.matchItem')}: <i>{hit}</i></> : null}</div>
                    </div>
                    <Icon name="chevron" size={16} className="flip-rtl" />
                  </button>
                );
              })}
              {found.length === 40 && <p className="muted small">{t('insp.moreMatches')}</p>}
            </div>
          )}

          {/* in the order they are chosen: department → equipment → discipline (the title follows the equipment) */}
          <div className="grid g2">
            <Field label={t('c.department')}>
              <select value={dept} disabled={member && !!user.departmentId} onChange={e => { setDept(e.target.value); setEqId(''); }}>
                <option value="">{t('c.all')}</option>
                {data.departments.map(x => <option key={x.id} value={x.id}>{b(x.name)}</option>)}
              </select>
            </Field>
            <Field label={t('c.equipment')} required>
              <select value={eqId} onChange={e => setEqId(e.target.value)}>
                <option value="">{allowed.length ? t('insp.chooseEq') : t('insp.noEquipment')}</option>
                {eq && !allowed.includes(eq) && <option value={eq.id}>{equipmentTitle(eq)}</option>}
                {allowed.map(e => <option key={e.id} value={e.id}>{equipmentTitle(e)}{dept ? '' : ` · ${b(data.dept(e.departmentId)?.name)}`}</option>)}
              </select>
            </Field>
            <Field label={t('c.discipline')}>
              {member ? <input disabled value={t('disc.' + user.discipline)} /> : (
                <select value={d} onChange={e => setDisc(e.target.value as Discipline)} disabled={!eq}>
                  <option value="">{eq ? t('insp.chooseDisc') : '—'}</option>
                  {discs.map(x => <option key={x} value={x}>{t('disc.' + x)} ({eq?.parts[x].length})</option>)}
                </select>
              )}
            </Field>
            <Field label={t('insp.titleField')}><input disabled value={eq ? equipmentTitle(eq) : ''} placeholder={t('insp.titleAuto')} /></Field>
          </div>

          {eq && d && !exists && (
            <div className="mt checklist-edit">
              <div className="row gap wrap mb">
                <h3 className="grow">{t('insp.checklist')} · {t('disc.' + d)} <span className="badge tone-blue">{items.length}</span>
                  {adjusted && <span className="badge tone-orange">{t('insp.adjusted')}</span>}</h3>
                {adjusted && <button type="button" className="btn link sm" onClick={() => setItems(standard)}>{t('insp.resetChecklist')}</button>}
              </div>
              <p className="muted small">{t('insp.checklistHint')}</p>
              <ol className="part-preview editable">
                {items.map((p, k) => (
                  <li key={p}>
                    <span className="grow">{p}</span>
                    <button type="button" className="icon-btn sm" aria-label={`${t('insp.removeItem')}: ${p}`} title={t('insp.removeItem')}
                      onClick={() => setItems(items.filter((_, j) => j !== k))}><Icon name="x" size={16} /></button>
                  </li>
                ))}
              </ol>
              <div className="row gap mt">
                <input className="grow add-item" value={newItem} maxLength={200} placeholder={t('insp.addItemPh')}
                  onChange={e => setNewItem(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
                <button type="button" className="btn ghost" disabled={!newItem.trim()} onClick={add}><Icon name="plus" size={16} />{t('insp.addItem')}</button>
              </div>
            </div>
          )}
          {eq && d && exists && (
            <div className="mt">
              <h3 className="mb">{t('insp.parts')} · {t('disc.' + d)} <span className="badge tone-blue">{eq.parts[d].length}</span></h3>
              <ol className="part-preview">{eq.parts[d].map((p, k) => <li key={k}>{p}</li>)}</ol>
            </div>
          )}
          {!allowed.length && can.manageEquipment(user) && <p className="muted mt">{t('insp.addEquipmentFirst')} <Link to="/equipment">{t('nav.equipment')}</Link></p>}
          <div className="row gap mt">
            <button className="btn primary" disabled={!eq || !d || busy || (!exists && !items.length)} onClick={create}>
              <Icon name={exists ? 'checklist' : 'plus'} />{exists ? t('insp.openExisting') : t('insp.create')}</button>
            {exists && <span className="small muted">{t('insp.existsHint')}</span>}
          </div>
        </Card>
      )}
    </>
  );
}
