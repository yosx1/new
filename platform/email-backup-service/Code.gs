/**
 * KCP Cold Run Readiness — e-mail & weekly backup service (Google Apps Script).
 *
 * The free Firebase (Spark) plan has no server, so this script, running in the platform owner's
 * Google account, does the two jobs that need one:
 *   1. doPost: e-mails the Excel results of an approved inspection to the recipients chosen in
 *      Settings. Every request is checked against Firebase: a valid sign-in, an active lead or
 *      administrator, an approved inspection. Recipients always come from Settings, never from the
 *      request, so the service cannot be used to send mail anywhere else.
 *   2. weeklyBackup: copies every Firestore collection to a dated folder in Google Drive, shares the
 *      backup folder with the backup e-mail from Settings and keeps the last KEEP_BACKUPS copies.
 *
 * Setup: set PROJECT_ID and WEB_API_KEY, run setup() once (authorise when asked), then Deploy → Web app
 * (Execute as: Me, Who has access: Anyone) and paste the /exec URL into Settings in the platform.
 */
const PROJECT_ID = 'kcp-coldrun-2026';
const APP_URL = 'https://' + PROJECT_ID + '.web.app';
const WEB_API_KEY = 'PASTE_FIREBASE_WEB_API_KEY'; // the VITE_FIREBASE_API_KEY value from .env.local
const KEEP_BACKUPS = 12;
const MAX_SENDS_PER_INSPECTION = 3;
const COLLECTIONS = ['config', 'users', 'invites', 'devices', 'departments', 'equipment', 'shutdowns', 'documents',
  'counters', 'inspections', 'notifications', 'audit', 'attachments'];
const FS = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents';

/** Run once from the editor: authorises the script and schedules the weekly backup (Fridays, 02:00). */
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'weeklyBackup') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('weeklyBackup').timeBased().onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(2).everyWeeks(1).create();
  getDoc_('config/settings'); // checks access to the database (and asks for permission)
  return 'Weekly backup scheduled. Now deploy as a web app.';
}

/* ---------------- web app ---------------- */

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const caller = verifyCaller_(req.idToken);
    if (req.test) {
      if (caller.role !== 'admin') return json_({ ok: false, error: 'admin only' });
      return json_({ ok: true, recipients: recipients_(getDoc_('config/settings') || {}).length });
    }
    if (['admin', 'manager'].indexOf(caller.role) < 0) return json_({ ok: false, error: 'not allowed' });
    if (!/^[\w-]{1,128}$/.test(req.inspectionId || '')) return json_({ ok: false, error: 'bad inspection' });
    const insp = getDoc_('inspections/' + req.inspectionId);
    if (!insp || insp.status !== 'approved') return json_({ ok: false, error: 'inspection not approved' });

    const props = PropertiesService.getScriptProperties();
    const key = 'sent_' + req.inspectionId;
    const sent = Number(props.getProperty(key) || 0);
    if (sent >= MAX_SENDS_PER_INSPECTION) return json_({ ok: false, error: 'already sent' });

    const to = recipients_(getDoc_('config/settings') || {});
    if (!to.length) return json_({ ok: false, error: 'no recipients' });
    const file = Utilities.newBlob(Utilities.base64Decode(req.file), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      String(req.fileName || insp.code + '.xlsx').replace(/[\\/:*?"<>|]/g, '-').slice(0, 120));
    if (file.getBytes().length > 15 * 1024 * 1024) return json_({ ok: false, error: 'file too large' });

    const ar = req.lang !== 'en';
    const s = insp.summary || {};
    const fin = insp.approval || {};
    const DISC = { mechanical: ['Mechanical', 'ميكانيك'], electrical: ['Electrical', 'كهرباء'], instrumentation: ['Instrumentation & Control', 'السيطرة والأجهزة'], production: ['Production', 'الإنتاج'] };
    const disc = (DISC[insp.discipline] || [insp.discipline, insp.discipline])[ar ? 1 : 0];
    const link = APP_URL + '/inspections/' + req.inspectionId;
    const subject = (ar ? 'تم اعتماد فحص ' : 'Inspection approved: ') + insp.title + ' · ' + disc + ' · ' + insp.code;
    const rows = [
      [ar ? 'المعدة' : 'Equipment', insp.title],
      [ar ? 'الاختصاص' : 'Discipline', disc],
      [ar ? 'التوقف السنوي' : 'Shutdown', insp.shutdownName || ''],
      [ar ? 'الأجزاء' : 'Parts', (s.total || 0) + ' · ' + (ar ? 'سليم ' : 'OK ') + (s.ok || 0) + ' · ' + (ar ? 'غير سليم ' : 'Not OK ') + (s.notok || 0) + ' · ' + (ar ? 'تم الإصلاح ' : 'fixed ') + (s.fixed || 0)],
      [ar ? 'اعتمده' : 'Approved by', fin.byName || caller.name],
    ];
    const html = '<div dir="' + (ar ? 'rtl' : 'ltr') + '" style="font-family:Arial,sans-serif;font-size:14px;color:#142036">'
      + '<h2 style="color:#0b2a5b;margin:0 0 12px">' + esc_(subject) + '</h2><table cellpadding="6" style="border-collapse:collapse">'
      + rows.map(function (r) { return '<tr><td style="color:#667085">' + esc_(r[0]) + '</td><td><b>' + esc_(r[1]) + '</b></td></tr>'; }).join('')
      + '</table><p>' + (ar ? 'النتائج الكاملة مرفقة بملف Excel.' : 'The full results are attached as an Excel file.') + '</p>'
      + '<p><a href="' + link + '" style="background:#1565d8;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">'
      + (ar ? 'فتح الفحص' : 'Open the inspection') + '</a></p></div>';
    MailApp.sendEmail({ to: to.join(','), subject: subject, htmlBody: html, body: subject + '\n' + link, attachments: [file], name: 'KCP Cold Run Readiness' });
    props.setProperty(key, String(sent + 1));
    return json_({ ok: true, sent: to.length });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err).slice(0, 200) });
  }
}

function doGet() { return json_({ ok: true, service: 'kcp-coldrun' }); }

/* ---------------- weekly backup ---------------- */

function weeklyBackup() {
  const root = folder_(DriveApp.getRootFolder(), 'KCP Cold Run backups');
  const stamp = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd HH-mm');
  const dir = root.createFolder(stamp);
  const counts = {};
  COLLECTIONS.forEach(function (c) {
    const docs = queryAll_(c);
    counts[c] = docs.length;
    // Attachments carry photos, so they are split to keep each file a reasonable size.
    const size = c === 'attachments' ? 40 : 5000;
    const parts = Math.max(1, Math.ceil(docs.length / size));
    for (let p = 0; p < parts; p++) {
      dir.createFile(c + (parts > 1 ? '-' + (p + 1) : '') + '.json', JSON.stringify(docs.slice(p * size, (p + 1) * size)), MimeType.PLAIN_TEXT);
    }
  });
  dir.createFile('README.txt', 'KCP Cold Run Readiness backup ' + stamp + ' (UTC)\nProject: ' + PROJECT_ID + '\n\n'
    + Object.keys(counts).map(function (k) { return k + ': ' + counts[k]; }).join('\n')
    + '\n\nEach file holds Firestore documents in REST format ({name, fields, createTime, updateTime}).', MimeType.PLAIN_TEXT);

  // Keep the newest KEEP_BACKUPS folders.
  const all = [];
  const it = root.getFolders();
  while (it.hasNext()) all.push(it.next());
  all.sort(function (a, b) { return b.getName() < a.getName() ? -1 : 1; });
  all.slice(KEEP_BACKUPS).forEach(function (f) { f.setTrashed(true); });

  const settings = getDoc_('config/settings') || {};
  const email = String(settings.backupEmail || '').trim();
  if (email) {
    try { if (root.getViewers().map(function (u) { return u.getEmail(); }).indexOf(email) < 0) root.addViewer(email); } catch (e) { /* not a Google account */ }
    const total = Object.keys(counts).reduce(function (n, k) { return n + counts[k]; }, 0);
    MailApp.sendEmail({ to: email, name: 'KCP Cold Run Readiness', subject: 'Weekly backup completed · ' + stamp,
      body: 'The weekly backup of KCP Cold Run Readiness is complete (' + total + ' records).\n\nFolder: ' + root.getUrl()
        + '\nThis backup: ' + dir.getUrl() + '\n\n' + Object.keys(counts).map(function (k) { return k + ': ' + counts[k]; }).join('\n') });
  }
  return counts;
}

/* ---------------- helpers ---------------- */

function verifyCaller_(idToken) {
  if (!idToken) throw new Error('not signed in');
  const r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + apiKey_(), {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions: true,
    // the web API key only accepts requests from the app's own address
    headers: { Referer: APP_URL + '/' } });
  const u = r.getResponseCode() === 200 && (JSON.parse(r.getContentText()).users || [])[0];
  if (!u) throw new Error('invalid sign-in');
  const profile = getDoc_('users/' + u.localId);
  if (!profile || profile.active !== true) throw new Error('inactive user');
  profile.uid = u.localId;
  return profile;
}

function recipients_(settings) {
  const chosen = settings.reportRecipientUids || [];
  const users = queryAll_('users').map(function (d) { const v = decode_(d.fields || {}); v.id = d.name.split('/').pop(); return v; })
    .filter(function (u) { return u.active === true && u.email; });
  const list = (chosen.length ? users.filter(function (u) { return chosen.indexOf(u.id) >= 0; })
    : users.filter(function (u) { return u.role === 'manager' || u.role === 'admin'; })).map(function (u) { return String(u.email).toLowerCase(); });
  (settings.reportEmails || []).forEach(function (e) { e = String(e).trim().toLowerCase(); if (/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(e) && list.indexOf(e) < 0) list.push(e); });
  return list.slice(0, 50);
}

/** The Firebase web API key (public: it is in the web app too, and only accepts requests from the app's address). */
function apiKey_() { return WEB_API_KEY; }

function auth_() { return { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'x-goog-user-project': PROJECT_ID }; }

function api_(url, opts) {
  const r = UrlFetchApp.fetch(url, Object.assign({ headers: auth_(), muteHttpExceptions: true }, opts || {}));
  if (r.getResponseCode() >= 300) throw new Error(url.split('?')[0].split('/').slice(-2).join('/') + ' ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 300));
  return JSON.parse(r.getContentText() || '{}');
}

function getDoc_(path) {
  const r = UrlFetchApp.fetch(FS + '/' + path, { headers: auth_(), muteHttpExceptions: true });
  if (r.getResponseCode() === 404) return null;
  if (r.getResponseCode() >= 300) throw new Error('firestore ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 300));
  return decode_(JSON.parse(r.getContentText()).fields || {});
}

/** Every document of a collection id at any depth (so sub-collections such as results are included). */
function queryAll_(collectionId) {
  const out = [];
  let last = null;
  for (;;) {
    const q = { structuredQuery: { from: [{ collectionId: collectionId, allDescendants: true }], orderBy: [{ field: { fieldPath: '__name__' } }], limit: 300 } };
    if (last) q.structuredQuery.startAt = { values: [{ referenceValue: last }], before: false };
    const page = api_(FS + ':runQuery', { method: 'post', contentType: 'application/json', payload: JSON.stringify(q) });
    const docs = page.filter(function (x) { return x.document; }).map(function (x) { return x.document; });
    docs.forEach(function (d) { out.push(d); });
    if (docs.length < 300) return out;
    last = docs[docs.length - 1].name;
  }
}

function decode_(fields) {
  const o = {};
  Object.keys(fields).forEach(function (k) { o[k] = val_(fields[k]); });
  return o;
}
function val_(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('mapValue' in v) return decode_(v.mapValue.fields || {});
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val_);
  if ('referenceValue' in v) return v.referenceValue;
  return null;
}

function folder_(parent, name) { const it = parent.getFoldersByName(name); return it.hasNext() ? it.next() : parent.createFolder(name); }
function esc_(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
