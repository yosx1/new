import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { ref } from '../lib/db';
import type { UserProfile } from '../types';

type State =
  | { phase: 'loading' }
  | { phase: 'signedOut'; reason?: 'inactive' | 'revoked' | 'noProfile' }
  | { phase: 'ready'; fbUser: User; user: UserProfile; deviceDocId: string };

const Ctx = createContext<State>({ phase: 'loading' });
export const APP_VERSION = '1.0.0';

export function deviceId(): string {
  try {
    let id = localStorage.getItem('deviceId');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('deviceId', id); }
    return id;
  } catch {
    return 'session-' + Math.random().toString(36).slice(2);
  }
}

export function describeDevice() {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Device';
  const br = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const mobile = /Mobi|Android|iPhone|iPad/.test(ua);
  return { label: `${os} · ${br}`, platform: mobile ? 'mobile' : 'desktop', userAgent: ua.slice(0, 300) };
}

const SEEN_KEY = 'deviceSeenAt';
async function registerDevice(user: UserProfile, id: string) {
  const r = ref('devices', id);
  const info = describeDevice();
  const snap = await getDoc(r).catch(() => null);
  if (!snap?.exists()) {
    await setDoc(r, {
      uid: user.id, userName: user.name, ...info, appVersion: APP_VERSION,
      firstSeen: serverTimestamp(), lastSeen: serverTimestamp(), revoked: false,
    });
  } else {
    // Throttle heartbeat writes to keep within the free-tier write quota.
    let last = 0;
    try { last = Number(localStorage.getItem(SEEN_KEY) || 0); } catch { /* ignore */ }
    if (Date.now() - last > 3 * 3600_000) {
      await updateDoc(r, { userName: user.name, ...info, appVersion: APP_VERSION, lastSeen: serverTimestamp() });
      try { localStorage.setItem(SEEN_KEY, String(Date.now())); } catch { /* ignore */ }
    }
  }
}

/** First sign-in of someone the administrator invited by email: turn the invitation into a profile. */
async function claimInvite(fbUser: User) {
  const email = fbUser.email?.toLowerCase();
  if (!email || !fbUser.emailVerified) return;
  const inv = await getDoc(ref('invites', email));
  if (!inv.exists()) return;
  const i = inv.data();
  const b = writeBatch(db);
  b.set(ref('users', fbUser.uid), {
    name: i.name || fbUser.displayName || email, email, role: i.role, departmentId: i.departmentId ?? null,
    phone: i.phone ?? '', active: true, lang: 'ar', createdAt: serverTimestamp(), createdBy: i.invitedBy,
  });
  b.delete(inv.ref);
  await b.commit();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ phase: 'loading' });

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;
    let unsubDevice: (() => void) | undefined;
    const cleanup = () => { unsubProfile?.(); unsubDevice?.(); unsubProfile = unsubDevice = undefined; };

    const unsubAuth = onAuthStateChanged(auth, fbUser => {
      cleanup();
      if (!fbUser) { setState(s => (s.phase === 'signedOut' ? s : { phase: 'signedOut' })); return; }
      const devId = `${fbUser.uid}_${deviceId()}`;
      let deviceRegistered = false;

      let noProfileTimer: ReturnType<typeof setTimeout> | undefined;
      let claimTried = false;
      unsubProfile = onSnapshot(ref('users', fbUser.uid), snap => {
        clearTimeout(noProfileTimer);
        if (!snap.exists()) {
          if (snap.metadata.fromCache) return; // wait for the server before deciding
          if (!claimTried) { claimTried = true; claimInvite(fbUser).catch(e => console.warn('invite claim', e)); }
          // First-time setup writes the profile right after creating the account; give it a moment.
          noProfileTimer = setTimeout(() => { cleanup(); signOut(auth); setState({ phase: 'signedOut', reason: 'noProfile' }); }, 6000);
          return;
        }
        const user = { id: snap.id, ...snap.data() } as UserProfile;
        if (!user.active) { cleanup(); signOut(auth); setState({ phase: 'signedOut', reason: 'inactive' }); return; }
        setState({ phase: 'ready', fbUser, user, deviceDocId: devId });

        if (!deviceRegistered) {
          deviceRegistered = true;
          registerDevice(user, devId).catch(e => console.warn('device registration', e)).finally(() => {
            unsubDevice = onSnapshot(ref('devices', devId), d => {
              if (d.exists() && d.data().revoked) { cleanup(); signOut(auth); setState({ phase: 'signedOut', reason: 'revoked' }); }
            }, () => { /* offline / permission: ignore */ });
          });
        }
      }, err => {
        console.warn('profile', err);
        cleanup(); signOut(auth); setState({ phase: 'signedOut', reason: 'inactive' });
      });
    });
    return () => { cleanup(); unsubAuth(); };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useAuthState = () => useContext(Ctx);

/** For components rendered inside the signed-in shell. */
export function useUser(): UserProfile {
  const s = useContext(Ctx);
  if (s.phase !== 'ready') throw new Error('useUser outside signed-in area');
  return s.user;
}
export function useDeviceDocId() {
  const s = useContext(Ctx);
  return s.phase === 'ready' ? s.deviceDocId : '';
}
