import { useEffect, useRef, useState } from 'react';
import { getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { col, ref } from '../lib/db';
import { loadAttachment, openDataUrl, saveAttachment } from '../lib/files';
import { useI18n } from '../i18n/I18n';
import { useUser } from '../auth/Auth';
import { Icon } from './Icon';
import { Modal, errMsg, useFeedback } from './ui';
import type { Attachment } from '../types';

export function Thumb({ id, label, onRemove }: { id: string; label?: string; onRemove?: () => void }) {
  const [a, setA] = useState<Attachment | null | undefined>(undefined);
  const [zoom, setZoom] = useState(false);
  useEffect(() => { let on = true; loadAttachment(id).then(x => on && setA(x)); return () => { on = false; }; }, [id]);
  const isImg = a?.mime.startsWith('image/');
  return (
    <div className="photo">
      {a === undefined ? null : !a ? <Icon name="x" /> : isImg
        ? <img src={a.data} alt={a.name} loading="lazy" onClick={() => setZoom(true)} />
        : <button className="add-photo" style={{ border: 0 }} onClick={() => openDataUrl(a.data)}><Icon name="file" /><span className="ellipsis" style={{ maxWidth: 80 }}>{a.name}</span></button>}
      {label && <span className="tag">{label}</span>}
      {onRemove && <button className="rm" onClick={onRemove} aria-label="remove"><Icon name="x" size={14} /></button>}
      {zoom && a && <Modal title={a.name} onClose={() => setZoom(false)} wide><img src={a.data} alt="" style={{ width: '100%', borderRadius: 10 }} /></Modal>}
    </div>
  );
}

/** Button that captures (camera on phones) or picks files and stores them as attachments. */
export function AddFiles({ onAdded, meta, label, accept = 'image/*', capture, multiple = true }: {
  onAdded: (ids: string[]) => void;
  meta: Pick<Attachment, 'ownerType' | 'ownerId' | 'kind'> & { inspectionId?: string | null };
  label: string; accept?: string; capture?: boolean; multiple?: boolean;
}) {
  const user = useUser();
  const { t } = useI18n();
  const { toast } = useFeedback();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const ids: string[] = [];
    for (const f of files) {
      try { ids.push(await saveAttachment(user, f, meta)); } catch (e) { toast(errMsg(e, t), 'err'); }
    }
    setBusy(false);
    if (ids.length) onAdded(ids);
    if (input.current) input.current.value = '';
  };
  return (
    <>
      <button type="button" className="add-photo" onClick={() => input.current?.click()} disabled={busy}>
        {busy ? <span className="spinner" style={{ width: 22, height: 22 }} /> : <Icon name={accept.startsWith('image') ? 'camera' : 'file'} />}
        <span>{label}</span>
      </button>
      <input ref={input} type="file" hidden accept={accept} multiple={multiple} {...(capture ? { capture: 'environment' } : {})}
        onChange={e => pick(e.target.files)} />
    </>
  );
}

/** Attachments linked to a record (inspection, equipment, defect) listed by owner. */
export function OwnerFiles({ ownerType, ownerId, canAdd, inspectionId }: { ownerType: Attachment['ownerType']; ownerId: string; canAdd: boolean; inspectionId?: string }) {
  const { t } = useI18n();
  const user = useUser();
  const [ids, setIds] = useState<{ id: string; createdBy: string }[]>([]);
  const load = () => getDocs(query(col('attachments'), where('ownerType', '==', ownerType), where('ownerId', '==', ownerId)))
    .then(s => setIds(s.docs.map(d => ({ id: d.id, createdBy: d.data().createdBy as string })))).catch(() => {});
  useEffect(() => { load(); }, [ownerType, ownerId]); // eslint-disable-line
  return (
    <div className="photos">
      {ids.map(x => <Thumb key={x.id} id={x.id} onRemove={x.createdBy === user.id || user.role === 'admin'
        ? () => deleteDoc(ref('attachments', x.id)).then(load) : undefined} />)}
      {canAdd && <AddFiles label={t('c.addFile')} accept="image/*,application/pdf" meta={{ ownerType, ownerId, kind: 'file', inspectionId }} onAdded={() => load()} />}
      {!ids.length && !canAdd && <span className="muted">{t('c.none')}</span>}
    </div>
  );
}
