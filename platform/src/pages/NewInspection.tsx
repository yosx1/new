import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { useUser } from '../auth/Auth';
import { createInspection } from '../lib/actions';
import { can, inspectionId } from '../lib/rules';
import { Card, Field, PageHead, errMsg, useFeedback } from '../components/ui';
import { Tip } from '../components/Tips';
import { Icon } from '../components/Icon';
import type { Discipline } from '../types';

export default function NewInspection() {
  const { t, b } = useI18n();
  const user = useUser();
  const data = useData();
  const nav = useNavigate();
  const { toast } = useFeedback();
  const member = user.role === 'member';
  const [dept, setDept] = useState(member && user.departmentId ? user.departmentId : '');
  const [eqId, setEqId] = useState('');
  const [disc, setDisc] = useState<Discipline | ''>(member && user.discipline ? user.discipline : '');
  const [busy, setBusy] = useState(false);
  const sd = data.shutdown;

  const choices = useMemo(() => data.equipment.filter(e => e.active && (!dept || e.departmentId === dept) && can.disciplinesFor(user, e).length),
    [data.equipment, dept, user]);
  const eq = data.eq(eqId);
  const discs = eq ? can.disciplinesFor(user, eq) : [];
  const d: Discipline | '' = disc && discs.includes(disc) ? disc : discs.length === 1 ? discs[0] : '';
  const exists = !!(sd && eq && d && data.inspections.some(i => i.id === inspectionId(sd.id, eq.id, d)));

  const create = async () => {
    if (!sd || !eq || !d) return;
    setBusy(true);
    try {
      const id = await createInspection(user, sd, eq, d);
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
                <option value="">{choices.length ? t('insp.chooseEq') : t('insp.noEquipment')}</option>
                {choices.map(e => <option key={e.id} value={e.id}>{e.name}{dept ? '' : ` — ${b(data.dept(e.departmentId)?.name)}`}</option>)}
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
            <Field label={t('insp.titleField')}><input disabled value={eq?.name ?? ''} placeholder={t('insp.titleAuto')} /></Field>
          </div>

          {eq && d && (
            <div className="mt">
              <h3 className="mb">{t('insp.parts')} · {t('disc.' + d)} <span className="badge tone-blue">{eq.parts[d].length}</span></h3>
              <ol className="part-preview">{eq.parts[d].map((p, k) => <li key={k}>{p}</li>)}</ol>
            </div>
          )}
          {!choices.length && can.manageEquipment(user) && <p className="muted mt">{t('insp.addEquipmentFirst')} <Link to="/equipment">{t('nav.equipment')}</Link></p>}
          <div className="row gap mt">
            <button className="btn primary" disabled={!eq || !d || busy} onClick={create}><Icon name={exists ? 'checklist' : 'plus'} />{exists ? t('insp.openExisting') : t('insp.create')}</button>
            {exists && <span className="small muted">{t('insp.existsHint')}</span>}
          </div>
        </Card>
      )}
    </>
  );
}
