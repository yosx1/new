import { Suspense, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { flushUsage, updateDoc } from '../lib/fs';
import { auth } from '../firebase';
import { useUser } from '../auth/Auth';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { ref } from '../lib/db';
import { can, inMyPool } from '../lib/rules';
import { Icon } from './Icon';
import { NetworkBackground } from './NetworkBackground';

interface NavItem { to: string; icon: string; key: string; show?: boolean; badge?: number }

export function Layout() {
  const user = useUser();
  const { t, lang, setLang, b } = useI18n();
  const data = useData();
  const nav = useNavigate();
  const loc = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [bell, setBell] = useState(false);

  useEffect(() => { setDrawer(false); setBell(false); window.scrollTo(0, 0); }, [loc.pathname]);
  // Keep the profile language in step so notifications/reports use it next time.
  useEffect(() => { if (user.lang !== lang) updateDoc(ref('users', user.id), { lang }).catch(() => {}); }, [lang, user.id, user.lang]);

  const taskCount = useMemo(() => data.inspections.filter(i => i.shutdownId === data.shutdown?.id
    && (user.role === 'member' ? inMyPool(user, i) : i.status === 'waiting_approval')).length, [data.inspections, data.shutdown, user]);
  const unread = data.notifications.filter(n => !n.read);

  // Reload after signing out so nothing of this person stays in memory and the next sign-in starts clean.
  const logout = async () => {
    await Promise.race([flushUsage().catch(() => {}), new Promise(r => setTimeout(r, 1500))]); // offline: don't wait
    await signOut(auth).catch(() => {});
    location.replace('/');
  };

  const main: NavItem[] = [
    { to: '/', icon: 'dashboard', key: 'nav.dashboard' },
    { to: '/tasks', icon: 'tasks', key: 'nav.tasks', badge: taskCount },
    { to: '/inspections', icon: 'checklist', key: 'nav.inspections' },
    { to: '/equipment', icon: 'factory', key: 'nav.equipment' },
    { to: '/reports', icon: 'chart', key: 'nav.reports', show: can.seeReports(user) },
    { to: '/documents', icon: 'book', key: 'nav.documents' },
    { to: '/help', icon: 'info', key: 'nav.help' },
  ].filter(x => x.show !== false);
  const admin: NavItem[] = [
    { to: '/users', icon: 'users', key: 'nav.users', show: can.manageSystem(user) },
    { to: '/devices', icon: 'phone', key: 'nav.devices', show: can.manageSystem(user) },
    { to: '/audit', icon: 'shield', key: 'nav.audit', show: can.seeAudit(user) },
    { to: '/settings', icon: user.role === 'member' ? 'user' : 'gear', key: user.role === 'member' ? 'nav.profile' : 'nav.settings' },
  ].filter(x => x.show !== false);

  const link = (x: NavItem) => (
    <NavLink key={x.to} to={x.to} end={x.to === '/'} className={({ isActive }) => 'nav-link' + (isActive ? ' on' : '')}>
      <Icon name={x.icon} /><span>{t(x.key)}</span>{!!x.badge && <b className="nav-badge">{x.badge}</b>}
    </NavLink>
  );

  const sidebar = (
    <>
      <div className="brand">
        <img src="/icon.svg" alt="" width={38} height={38} />
        <div><b>{t('app.name')}</b><small>{b(data.settings.plantName)}</small></div>
      </div>
      <button className="btn primary block new-btn" onClick={() => nav('/inspections/new')}><Icon name="plus" />{t('nav.new')}</button>
      <nav className="nav">{main.map(link)}</nav>
      <div className="nav-title">{t('nav.admin')}</div>
      <nav className="nav">{admin.map(link)}</nav>
      <div className="side-user">
        <Icon name="user" />
        <div className="grow"><b>{user.name}</b><small>{t('role.' + user.role)}</small></div>
        <button className="icon-btn" title={t('nav.logout')} onClick={() => void logout()}><Icon name="logout" className="flip-rtl" /></button>
      </div>
    </>
  );

  return (
    <div className="shell">
      <div className="app-bg" aria-hidden="true"><NetworkBackground variant="light" /></div>
      <aside className="sidebar">{sidebar}</aside>
      {drawer && <div className="overlay" onClick={() => setDrawer(false)}><aside className="sidebar drawer" onClick={e => e.stopPropagation()}>{sidebar}</aside></div>}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn only-mobile" aria-label="menu" onClick={() => setDrawer(true)}><Icon name="menu" /></button>
          <div className="grow topbar-title only-mobile">{t('app.name')}</div>
          <div className="grow only-desktop" />
          {!data.online ? <span className="net off" title={t('c.offline')}><Icon name="wifiOff" size={16} /><span className="only-desktop">{t('c.offline')}</span></span>
            : data.pendingWrites ? <span className="net sync"><Icon name="sync" size={16} /><span className="only-desktop">{t('c.syncing')}</span></span> : null}
          <button className="btn ghost sm" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} aria-label="language"><Icon name="globe" size={16} />{t('lang.switch')}</button>
          <div className="bell-wrap">
            <button className="icon-btn" aria-label={t('notif.title')} onClick={() => setBell(v => !v)}>
              <Icon name="bell" />{unread.length > 0 && <b className="dot">{unread.length}</b>}
            </button>
            {bell && (
              <div className="bell-menu">
                <div className="row between"><b>{t('notif.title')}</b>
                  {unread.length > 0 && <button className="btn link sm" onClick={() => unread.forEach(n => updateDoc(ref('notifications', n.id), { read: true }).catch(() => {}))}>{t('notif.markRead')}</button>}
                </div>
                {data.notifications.length === 0 ? <p className="muted">{t('c.empty')}</p> : data.notifications.map(n => (
                  <button key={n.id} className={'bell-item' + (n.read ? '' : ' unread')} onClick={() => {
                    if (!n.read) updateDoc(ref('notifications', n.id), { read: true }).catch(() => {});
                    // only plain in-app paths (no //host, no backslashes) — never an off-site redirect
                    nav(/^\/(?:[\w-][\w/?=&.-]*)?$/.test(n.link) ? n.link : '/');
                  }}>
                    <span>{b(n.title)}</span><small className="muted">{n.createdAt ? n.createdAt.toDate().toLocaleString(lang === 'ar' ? 'ar-IQ' : 'en-GB') : ''}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>
        <main className="content"><Suspense fallback={<div className="page-loading" />}><Outlet /></Suspense></main>
      </div>

      <nav className="bottombar">
        {[main[0], main[1], main[2], main[3]].map(x => (
          <NavLink key={x.to} to={x.to} end={x.to === '/'} className={({ isActive }) => (isActive ? 'on' : '')}>
            <Icon name={x.icon} /><span>{t(x.key)}</span>{!!x.badge && <b className="nav-badge">{x.badge}</b>}
          </NavLink>
        ))}
        <button onClick={() => setDrawer(true)}><Icon name="menu" /><span>{t('nav.more')}</span></button>
      </nav>
    </div>
  );
}
