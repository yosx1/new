# Cold Run Readiness – Karbala Cement Plant

Cold run tests of the yearly shutdown: each team checks the parts of its own discipline on every piece of equipment, Not OK parts go through corrective maintenance, and the Cold Run Test Manager approves. Arabic/English, works on phones, tablets and computers, installable as an app (PWA), keeps working offline, and runs on the **Firebase free (Spark) plan**.

> This system documents readiness only. It never authorizes operation, bypasses interlocks, or replaces LOTO, permits and formal operating authorization.

## What it does

| Area | Highlights |
|---|---|
| Departments | Raw Mill, Kiln, Cooler, Cement Mill (created automatically on first sign-in of the administrator). |
| Equipment | Each piece belongs to a department and has **mechanical, electrical, instrumentation and production parts**. Managed with **Download CSV → fill in Excel → Upload CSV** (one row per part: Department, Equipment, Part type, Part; `,` or `;`, UTF-8, Arabic names accepted) with a preview before import, or edited one by one. |
| New inspection | A team member picks an equipment of their department; the discipline is theirs, the title is the equipment name and the parts of that discipline are the checklist. One inspection per equipment + discipline + shutdown. |
| Workflow | **Waiting in your pool** (parts marked OK / Not OK with a note and photo) → **Active**: *Corrective maintenance* (Not OK parts are fixed and marked Fixed) → *Waiting approval* → *Approved* (Cold Run Test Manager or admin; or *Send back* with a reason) → **Done**. |
| Shutdown | Every inspection belongs to the current yearly shutdown. When all are approved, **Close shutdown & archive** moves them to Done, the active count returns to 0 and the next shutdown starts. |
| Reports | Overview by department and by discipline, Not OK parts & corrective maintenance, equipment not started, all inspections, work per person — filtered by shutdown/department/equipment/discipline/status, **Excel export** and print. Each inspection exports to Excel and prints as a PDF report. |
| Notifications | On approval the report recipients (Settings; default managers + admins) are notified in the app, and — with the optional Apps Script service in `email-backup-service/` — receive the Excel file by e-mail. The same service makes a weekly Google Drive backup. |
| Admin | Users & roles (invitations by e-mail or Google, discipline + department for team members, deactivate, password reset), devices (revoke = immediate sign-out), document library, settings, audit log, in-app guide and the PDF guide in `public/guide/`. |
| Offline | Firestore's persistent cache keeps data on the device; changes made offline are queued and synced. Every inspection carries a version number that the server checks, so concurrent saves never overwrite each other. |

### Roles
System Administrator · Cold Run Test Manager · Team Member (with a discipline — Mechanical, Electrical, Instrumentation & Control or Production — and a department). Permissions are enforced in `firestore.rules` (see `tests/rules.test.mjs`).

## Tech stack

React 18 + TypeScript + Vite, PWA (vite-plugin-pwa), Firebase Auth + Cloud Firestore (persistent offline cache), Firebase Hosting. No backend code is needed.

**Free-plan design choices**
- Cloud Functions and (for new projects) Cloud Storage need the paid Blaze plan, so all rules live in Firestore Security Rules, admin user creation uses a secondary client app, and photos/files are compressed and stored as Firestore documents (≈100–250 KB per photo, max ≈650 KB per file). Link large manuals by URL in the document library.
- Spark quotas: 50k reads / 20k writes / 1 GiB per day-project. The app keeps up to 3,000 inspections live, throttles device heartbeats and caches everything locally.
- If you later move to Blaze, photos can be moved to Cloud Storage without changing the data model (`attachments` documents).

## Setup

1. Create a Firebase project (console.firebase.google.com) and add a **Web app**.
2. Enable **Authentication → Email/Password** and create a **Firestore** database (production mode).
3. Copy `.env.example` to `.env.local` and fill in the web app keys.
4. Set your project id in `.firebaserc`.
5. Install and deploy:
   ```bash
   npm install
   npx firebase login
   npm run deploy        # builds, deploys hosting + Firestore rules + indexes
   ```
6. Open the site. The first visitor is asked to create the **System Administrator**. The four departments and the first yearly shutdown are created automatically. Add the equipment under **Equipment** (CSV upload) and the people under **Users**.

### Quickest: one command on your computer

Needs Node.js 20+ (nodejs.org) and Git. In a terminal:

```bash
git clone -b ccr-9545330f-jai40b https://github.com/yosx1/new.git
cd new/platform
npm install
npm run firebase:setup -- kcp-coldrun-2026      # choose your own unique project id
```

The script signs in through your browser (your Chrome profile), creates the free Firebase project, the web app, the Firestore database, enables Email/Password sign-in, builds and deploys, then prints the live link `https://<project-id>.web.app`. Re-running it is safe; finished steps are reused. Optional: `--location me-central2` (default `eur3`).

### Automatic deployment from GitHub (recommended)

The workflow `.github/workflows/firebase-deploy.yml` publishes the app to `https://<project-id>.web.app` on every merge to `main` (or on demand: **Actions → Deploy platform to Firebase → Run workflow**). One-time setup:

1. **Firebase project** – console.firebase.google.com → *Add project* (Spark/free plan is fine). Then:
   - *Build → Authentication → Get started → Email/Password → Enable*.
   - *Build → Firestore Database → Create database* (production mode, pick a region near Iraq, e.g. `europe-west`/`me-central`).
   - *Project settings → General → Your apps → Web (`</>`)* → register an app. Note `apiKey`, `projectId`, `appId`, `messagingSenderId`.
2. **Service account key** – *Project settings → Service accounts → Generate new private key* (downloads a JSON file). In Google Cloud console → *IAM*, make sure that account (`firebase-adminsdk-…@<project>.iam.gserviceaccount.com`) has the **Firebase Admin** role.
3. **GitHub secrets** – repository → *Settings → Secrets and variables → Actions → New repository secret*:

   | Secret | Value |
   |---|---|
   | `FIREBASE_SERVICE_ACCOUNT` | the whole content of the JSON key file |
   | `FIREBASE_PROJECT_ID` | `projectId` |
   | `FIREBASE_API_KEY` | `apiKey` |
   | `FIREBASE_APP_ID` | `appId` |
   | `FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
4. Merge to `main` (or run the workflow manually). The run summary shows the live URL.
5. Open the URL on any phone, tablet or PC. The first visitor creates the System Administrator. On phones use *Add to Home Screen* / *Install app* to get an app icon that also works offline.

### Local development with emulators
```bash
echo "VITE_FIREBASE_PROJECT_ID=demo-coldrun
VITE_FIREBASE_API_KEY=demo-key
VITE_USE_EMULATORS=true" > .env.local
npx firebase emulators:start --only auth,firestore --project demo-coldrun &
npm run dev
```

### Tests
Everything runs locally against the Firebase emulators — no real project or credentials needed.

```bash
npm run check        # typecheck + lint + unit tests + production build + security-rule tests
npm run test:e2e     # end-to-end in Chromium on the emulators (needs Java 11+)
```

| Command | What it covers |
|---|---|
| `npm run typecheck` | TypeScript, strict |
| `npm run lint` | ESLint (TypeScript + React hooks rules) |
| `npm run test:unit` | Vitest: workflow logic and roles (`src/lib/rules.ts`), CSV import/export, Excel writer, usage meter |
| `npm run test:rules` | `tests/rules.test.mjs` — every Firestore permission: roles, team scope, workflow transitions, version checks, append-only audit, usage counters, nothing readable or writable outside the model |
| `npm run test:e2e` | `tests/e2e/` (Playwright): first-run setup, users & invitations, equipment CSV, a full cold run by four people (check → Not OK with photo → fix → approve / send back → archive), Excel files opened with openpyxl, admin rename/delete with audit, **what each role can and cannot see** (members of different disciplines and departments, manager), no page flicker, pop-ups above the sidebar, phone layout in Arabic. Screenshots land in `tests/e2e/out/`. |

The end-to-end run needs Chromium (`npx playwright install chromium`) and Python 3 with `openpyxl` (an independent check of the Excel files). CI (`.github/workflows/platform-ci.yml`) runs all of the above on every push, plus `npm audit --omit=dev`.

### Staying on the free plan
- Each device keeps only the **current shutdown** live; inspections of closed shutdowns load on demand (from the device cache when nothing changed) and totals use count queries.
- Team members load only their own discipline and department.
- Photos are read from the device cache; saving a part writes without reading first.
- The app counts its own reads/writes/deletes (`src/lib/fs.ts` → `usage/{day}`); the Apps Script service e-mails administrators at 25/50/75/90/100 % of the daily limits, stored data and the e-mail quota. Today's use is shown in Settings → Plan & billing.

## Data model (Firestore)

`users` (role, discipline, departmentId), `invites`, `devices`, `departments`, `equipment` (name, departmentId, parts per discipline), `shutdowns` + `config/shutdown` (current), `inspections` (id = shutdown_equipment_discipline; parts snapshot, results per part, summary, status, approval / rejection), `attachments`, `documents`, `notifications`, `audit` (append-only), `counters`, `config/settings`, `config/setup`.

## Known limitations (v1)
- PDF export uses the browser's print dialog ("Save as PDF"), which renders Arabic correctly on every device.
- E-mail and weekly backups need the free Google Apps Script service in `email-backup-service/` (one-time setup, see the PDF guide).
- Deactivated users cannot be deleted from Firebase Auth without the Admin SDK; they are blocked by the rules instead.
- Archiving a shutdown cannot be undone.
