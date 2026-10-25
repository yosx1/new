#!/usr/bin/env node
/**
 * One-command Firebase setup + deploy, run on your own computer:
 *
 *   cd platform
 *   npm install
 *   npm run firebase:setup -- <project-id> [--location eur3]
 *
 * 1. Signs in to Firebase (opens your default browser / Chrome profile).
 * 2. Creates the project if it does not exist (free Spark plan).
 * 3. Registers the web app and writes .env.local with its config.
 * 4. Creates the Firestore database.
 * 5. Enables Email/Password sign-in.
 * 6. Builds and deploys Hosting + Firestore rules + indexes.
 * Safe to run again: existing resources are reused.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const isWin = process.platform === 'win32';
const fb = join(root, 'node_modules', '.bin', isWin ? 'firebase.cmd' : 'firebase');

const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const projectId = args.find(a => !a.startsWith('--') && a !== flag('--location'));
const location = flag('--location', 'eur3');

if (!projectId || !/^[a-z][a-z0-9-]{5,29}$/.test(projectId)) {
  console.error('Usage: npm run firebase:setup -- <project-id> [--location eur3]');
  console.error('project-id: 6–30 chars, lowercase letters, digits and hyphens, e.g. kcp-coldrun-2026');
  process.exit(1);
}

// On Windows the .cmd shim needs a shell, so quote arguments that contain spaces or parentheses.
const q = a => (isWin && /[\s()]/.test(a) ? `"${a}"` : a);
const step = msg => console.log(`\n\x1b[1;34m▶ ${msg}\x1b[0m`);
const run = (cmdArgs, opts = {}) => {
  const r = spawnSync(isWin ? `"${fb}"` : fb, cmdArgs.map(q), { cwd: root, stdio: 'inherit', shell: isWin, ...opts });
  if (r.status !== 0) throw new Error(`firebase ${cmdArgs.join(' ')} failed`);
};
const json = cmdArgs => {
  try {
    const out = execFileSync(isWin ? `"${fb}"` : fb, [...cmdArgs, '--json'].map(q), { cwd: root, encoding: 'utf8', shell: isWin, stdio: ['ignore', 'pipe', 'pipe'] });
    return JSON.parse(out.slice(out.indexOf('{')));
  } catch (e) {
    const out = String(e.stdout ?? '');
    try { return JSON.parse(out.slice(out.indexOf('{'))); } catch { return { status: 'error', error: e.message }; }
  }
};

try {
  step('Signing in to Firebase (a browser window opens if needed)');
  run(['login']);

  step(`Project ${projectId}`);
  const projects = json(['projects:list']);
  if (!(projects.result ?? []).some(p => p.projectId === projectId)) {
    console.log('Creating project (free Spark plan)…');
    run(['projects:create', projectId, '--display-name', 'KCML Cold Run']);
  } else console.log('Project exists — reusing it.');

  step('Web app');
  let app = (json(['apps:list', 'WEB', '--project', projectId]).result ?? [])[0];
  if (!app) {
    const created = json(['apps:create', 'WEB', 'Cold Run Readiness', '--project', projectId]);
    if (created.status !== 'success') throw new Error('Could not create web app: ' + JSON.stringify(created.error ?? created));
    app = created.result;
  }
  console.log('App id:', app.appId);
  const cfgRes = json(['apps:sdkconfig', 'WEB', app.appId, '--project', projectId]);
  const cfg = cfgRes.result?.sdkConfig ?? cfgRes.result;
  if (!cfg?.apiKey) throw new Error('Could not read web app config: ' + JSON.stringify(cfgRes));
  writeFileSync(join(root, '.env.local'), [
    `VITE_FIREBASE_API_KEY=${cfg.apiKey}`,
    `VITE_FIREBASE_AUTH_DOMAIN=${cfg.authDomain}`,
    `VITE_FIREBASE_PROJECT_ID=${cfg.projectId}`,
    `VITE_FIREBASE_APP_ID=${cfg.appId}`,
    `VITE_FIREBASE_MESSAGING_SENDER_ID=${cfg.messagingSenderId ?? ''}`,
    'VITE_USE_EMULATORS=false', '',
  ].join('\n'));
  writeFileSync(join(root, '.firebaserc'), JSON.stringify({ projects: { default: projectId } }, null, 2) + '\n');
  console.log('Wrote .env.local and .firebaserc');

  step(`Firestore database (${location})`);
  const dbs = json(['firestore:databases:list', '--project', projectId]);
  const hasDefault = JSON.stringify(dbs.result ?? '').includes('(default)');
  if (!hasDefault) run(['firestore:databases:create', '(default)', '--location', location, '--project', projectId]);
  else console.log('Database exists — reusing it.');

  step('Email/Password sign-in');
  let authOk = false;
  try {
    const fbAuth = require('firebase-tools/lib/auth');
    const account = fbAuth.getGlobalDefaultAccount();
    const token = (await fbAuth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform'])).access_token;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-goog-user-project': projectId };
    const base = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`;
    let r = await fetch(`${base}?updateMask=signIn.email.enabled,signIn.email.passwordRequired`, {
      method: 'PATCH', headers, body: JSON.stringify({ signIn: { email: { enabled: true, passwordRequired: true } } }),
    });
    if (r.status === 404) {
      // Authentication not initialised yet ("Get started" never clicked) – initialise, then retry.
      await fetch(`https://identitytoolkit.googleapis.com/v2/projects/${projectId}/identityPlatform:initializeAuth`, { method: 'POST', headers, body: '{}' });
      r = await fetch(`${base}?updateMask=signIn.email.enabled,signIn.email.passwordRequired`, {
        method: 'PATCH', headers, body: JSON.stringify({ signIn: { email: { enabled: true, passwordRequired: true } } }),
      });
    }
    authOk = r.ok;
    if (!r.ok) console.log('API answered', r.status, (await r.text()).slice(0, 300));
  } catch (e) { console.log('Automatic enable failed:', e.message); }
  console.log(authOk ? 'Email/Password sign-in enabled.'
    : `Please enable it once by hand: https://console.firebase.google.com/project/${projectId}/authentication/providers → Email/Password → Enable`);

  step('Building the app');
  const b = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', shell: true });
  if (b.status !== 0) throw new Error('Build failed');

  step('Deploying Hosting, Firestore rules and indexes');
  run(['deploy', '--only', 'hosting,firestore', '--project', projectId]);

  console.log(`\n\x1b[1;32m✔ Live at https://${projectId}.web.app\x1b[0m`);
  console.log('Open it, create the System Administrator, then Settings → "Load example departments, equipment and checklists".');
  if (!authOk) console.log(`Remember: enable Email/Password at https://console.firebase.google.com/project/${projectId}/authentication/providers`);
} catch (e) {
  console.error(`\n\x1b[1;31m✖ ${e.message}\x1b[0m`);
  console.error('Fix the problem above and run the same command again — completed steps are skipped.');
  process.exit(1);
}
