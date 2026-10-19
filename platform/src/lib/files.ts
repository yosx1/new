import { addDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { col, ref } from './db';
import type { Attachment, UserProfile } from '../types';

/** Firestore documents are limited to 1 MiB; keep a safe margin for base64 overhead. */
export const MAX_DATA_URL = 900_000;

/** Resizes and re-encodes a photo so it fits comfortably in a Firestore document (~100–250 KB). */
export function compressImage(file: File, max = 1280, quality = 0.62): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let { width: w, height: h } = img;
      const r = Math.min(1, max / Math.max(w, h));
      w = Math.round(w * r); h = Math.round(h * r);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      let q = quality;
      let out = c.toDataURL('image/jpeg', q);
      while (out.length > MAX_DATA_URL && q > 0.3) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    img.src = url;
  });
}

export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export async function saveAttachment(
  user: UserProfile,
  file: File,
  meta: Pick<Attachment, 'ownerType' | 'ownerId' | 'kind'> & { inspectionId?: string | null },
): Promise<string> {
  const isImage = file.type.startsWith('image/');
  const data = isImage ? await compressImage(file) : await readAsDataUrl(file);
  if (data.length > MAX_DATA_URL) throw new Error('too-big');
  const d = await addDoc(col('attachments'), {
    ...meta,
    inspectionId: meta.inspectionId ?? null,
    name: file.name,
    mime: isImage ? 'image/jpeg' : file.type || 'application/octet-stream',
    size: data.length,
    data,
    createdBy: user.id,
    createdAt: serverTimestamp(),
  });
  return d.id;
}

const cache = new Map<string, Promise<Attachment | null>>();
export function loadAttachment(id: string): Promise<Attachment | null> {
  if (!cache.has(id)) {
    cache.set(id, getDoc(ref('attachments', id)).then(s => (s.exists() ? ({ id: s.id, ...s.data() } as Attachment) : null)).catch(() => null));
  }
  return cache.get(id)!;
}

export function openDataUrl(dataUrl: string) {
  fetch(dataUrl).then(r => r.blob()).then(b => window.open(URL.createObjectURL(b), '_blank'));
}

export function downloadText(name: string, text: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function toCsv(rows: (string | number | null | undefined)[][]) {
  return rows.map(r => r.map(v => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
}
