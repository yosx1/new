import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { useI18n } from '../i18n/I18n';
import { STATUS_TONE } from '../lib/rules';
import type { InspectionStatus, PartStatus } from '../types';

/* ---------- badges ---------- */
export function Badge({ tone = 'gray', children, icon }: { tone?: string; children: ReactNode; icon?: string }) {
  return <span className={`badge tone-${tone}`}>{icon && <Icon name={icon} size={13} />}{children}</span>;
}
export function StatusBadge({ status }: { status: InspectionStatus }) {
  const { t } = useI18n();
  return <Badge tone={STATUS_TONE[status]}>{t('st.' + status)}</Badge>;
}
const PART_TONE: Record<PartStatus, [string, string]> = { ok: ['green', 'check'], notok: ['red', 'x'], pending: ['orange', 'clock'] };
export function PartBadge({ status, fixed }: { status: PartStatus; fixed?: boolean }) {
  const { t } = useI18n();
  if (status === 'notok' && fixed) return <Badge tone="purple" icon="check">{t('part.fixed')}</Badge>;
  const [tone, icon] = PART_TONE[status];
  return <Badge tone={tone} icon={icon}>{t('part.' + status)}</Badge>;
}

/* ---------- layout bits ---------- */
export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={'card ' + className}>
      {(title || actions) && <header className="card-head"><h3>{title}</h3><div className="card-actions">{actions}</div></header>}
      {children}
    </section>
  );
}
export function PageHead({ title, sub, actions, back }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; back?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="page-head">
      {back && <button className="icon-btn" onClick={back} aria-label={t('c.back')}><Icon name="back" className="flip-rtl" /></button>}
      <div className="grow"><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div>
      {actions && <div className="row gap wrap">{actions}</div>}
    </div>
  );
}
export function Progress({ value, tone = 'green' }: { value: number; tone?: string }) {
  return <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
    <i className={'tone-bg-' + tone} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>;
}
export function Empty({ children, icon = 'list' }: { children?: ReactNode; icon?: string }) {
  const { t } = useI18n();
  return <div className="empty"><Icon name={icon} size={40} /><p>{children ?? t('c.empty')}</p></div>;
}
export function Spinner() { return <div className="spinner" aria-label="loading" />; }
export function Kpi({ label, value, tone = 'blue', icon, onClick, sub }: { label: string; value: ReactNode; tone?: string; icon?: string; onClick?: () => void; sub?: ReactNode }) {
  const C = onClick ? 'button' : 'div';
  return (
    <C className={`kpi tone-border-${tone}`} onClick={onClick}>
      {icon && <span className={`kpi-icon tone-${tone}`}><Icon name={icon} /></span>}
      <span className="kpi-val">{value}</span>
      <span className="kpi-label">{label}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </C>
  );
}
export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: [T, ReactNode][] }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([k, label]) => (
        <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{label}</button>
      ))}
    </div>
  );
}

/* ---------- forms ---------- */
export function Field({ label, children, hint, required, error }: { label: ReactNode; children: ReactNode; hint?: ReactNode; required?: boolean; error?: string | false }) {
  return (
    <label className={'field' + (error ? ' has-error' : '')}>
      <span className="field-label">{label}{required && <b className="req"> *</b>}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

/* ---------- modal ---------- */
export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const { t } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  // Callers pass a new onClose on every render; keep the latest in a ref so the effect below
  // runs only when the modal opens (re-running it would steal focus back to the first field).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', k);
    document.body.classList.add('no-scroll');
    box.current?.querySelector<HTMLElement>('input,select,textarea')?.focus();
    return () => { document.removeEventListener('keydown', k); document.body.classList.remove('no-scroll'); };
  }, []);
  return (
    <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" ref={box}>
        <header className="modal-head"><h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('c.close')}><Icon name="x" /></button></header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

/* ---------- toasts & confirm ---------- */
interface Feedback {
  toast: (msg: string, tone?: 'ok' | 'err' | 'info') => void;
  confirm: (title: string, body?: string, danger?: boolean) => Promise<boolean>;
}
const FCtx = createContext<Feedback>(null as unknown as Feedback);
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [toasts, setToasts] = useState<{ id: number; msg: string; tone: string }[]>([]);
  const [ask, setAsk] = useState<{ title: string; body?: string; danger?: boolean; resolve: (v: boolean) => void } | null>(null);
  const toast = useCallback((msg: string, tone: 'ok' | 'err' | 'info' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts(x => [...x, { id, msg, tone }]);
    setTimeout(() => setToasts(x => x.filter(y => y.id !== id)), tone === 'err' ? 6000 : 3000);
  }, []);
  const confirm = useCallback((title: string, body?: string, danger?: boolean) =>
    new Promise<boolean>(resolve => setAsk({ title, body, danger, resolve })), []);
  const done = (v: boolean) => { ask?.resolve(v); setAsk(null); };
  return (
    <FCtx.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" aria-live="polite">{toasts.map(x => <div key={x.id} className={'toast ' + x.tone}>{x.msg}</div>)}</div>
      {ask && (
        <Modal title={ask.title} onClose={() => done(false)} footer={<>
          <button className="btn ghost" onClick={() => done(false)}>{t('c.cancel')}</button>
          <button className={'btn ' + (ask.danger ? 'danger' : 'primary')} onClick={() => done(true)}>{t('c.confirm')}</button>
        </>}>{ask.body && <p>{ask.body}</p>}</Modal>
      )}
    </FCtx.Provider>
  );
}
export const useFeedback = () => useContext(FCtx);

/** Maps Firestore/Auth errors to a friendly message. */
export function errMsg(e: unknown, t: (k: string) => string) {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('permission-denied')) return t('c.permission');
  if ((e as Error)?.message === 'too-big') return t('c.fileTooBig');
  if ((e as Error)?.message === 'work-order') return t('wo.required');
  return t('c.error') + (code ? ` (${code})` : '');
}
