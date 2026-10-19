import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { updateDoc } from 'firebase/firestore';
import { auth } from '../firebase';
import { useUser } from '../auth/Auth';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { ref } from '../lib/db';
import { can, poolsForUser } from '../lib/rules';
import { Icon } from './Icon';

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

  const myPools = useMemo(() => poolsForUser(user), [user]);
  const taskCount = useMemo(() => {
    const insp = data.inspections.filter(i => i.pools?.some(p => myPools.includes(p))).length;
    const defs = data.defects.filter(d => d.status !== 'closed' && (d.assignedUid === user.id
      || (d.pool === user.role && !d.assignedUid)
      || (can.verifyDefect(user, d) && ['repair_completed', 'awaiting_verification'].includes(d.status)))).length;
    return insp + defs;
  }, [data.inspections, data.defects, myPools, user]);
  const unread = data.notifications.filter(n => !n.read);

  const main: NavItem[] = [
    { to: '/', icon: 'dashboard', key: 'nav.dashboard' },
    { to: '/tasks', icon: 'tasks', key: 'nav.tasks', badge: taskCount },
    { to: '/inspections', icon: 'checklist', key: 'nav.inspections' },
    { to: '/defects', icon: 'alert', key: 'nav.defects' },
    { to: '/equipment', icon: 'factory', key: 'nav.equipment' },
    { to: '/reports', icon: 'chart', key: 'nav.reports' },
    { to: '/documents', icon: 'book', key: 'nav.documents' },
  ];
  const admin: NavItem[] = [
    { to: '/templates', icon: 'list', key: 'nav.templates', show: can.manageSystem(user) },
    { to: '/users', icon: 'users', key: 'nav.users', show: can.manageSystem(user) },
    { to: '/devices', icon: 'phone', key: 'nav.devices', show: can.manageSystem(user) },
    { to: '/audit', icon: 'shield', key: 'nav.audit', show: can.seeAudit(user) },
    { to: '/settings', icon: 'gear', key: 'nav.settings' },
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
      {can.createInspection(user) && (
        <button className="btn primary block new-btn" onClick={() => nav('/inspections/new')}><Icon name="plus" />{t('nav.new')}</button>
      )}
      <nav className="nav">{main.map(link)}</nav>
      <div className="nav-title">{t('nav.admin')}</div>
      <nav className="nav">{admin.map(link)}</nav>
      <div className="side-user">
        <Icon name="user" />
        <div className="grow"><b>{user.name}</b><small>{t('role.' + user.role)}</small></div>
        <button className="icon-btn" title={t('nav.logout')} onClick={() => signOut(auth)}><Icon name="logout" className="flip-rtl" /></button>
      </div>
    </>
  );

  return (
    <div className="shell">
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
                    nav(n.link);
                  }}>
                    <span>{b(n.title)}</span><small className="muted">{n.createdAt ? n.createdAt.toDate().toLocaleString(lang === 'ar' ? 'ar-IQ' : 'en-GB') : ''}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>
        <main className="content"><Outlet /></main>
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
