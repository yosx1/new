# Cold Run Readiness – Karbala Cement Plant

Inspection and readiness management for Cold Run checks after maintenance. Arabic/English, works on phones, tablets and computers, installable as an app (PWA), keeps working offline, and runs on the **Firebase free (Spark) plan**.

> This system documents readiness only. It never authorizes operation, bypasses interlocks, or replaces LOTO, permits and formal operating authorization. The example checklists are **not** approved acceptance criteria — confirm every item, method and limit against plant procedures and equipment manuals before use.

## What it does

| Area | Highlights |
|---|---|
| Dashboard | Active / awaiting execution / in progress / awaiting CA / awaiting approval / approved, critical open defects, overdue CAs, readiness by department, status mix, recent defects and activity, follow-ups. Filters for department, equipment, dates, status and discipline. |
| Task pools | Work is routed to a **role**, not a person: checklist sections → their discipline, defects → the responsible discipline, approvals → the discipline, final review → supervisors. Anyone on shift with that role can pick it up ("Take it" / "Return to pool"); deactivating a user returns their open work to the pool. |
| New inspection | 3-step wizard with auto-generated ID (CR-YYYY-NNNN), all required fields, validation, draft auto-save, optional work-order attachments. The checklist is chosen automatically from the equipment (linked templates first, then category + maintenance type). |
| Execution | Mobile-first: one tap Pass / Fail / N/A per item; a detail sheet for measurements (equipment-specific unit/min/max, out-of-range warning), N/A reasons, photos (camera), files, assignee and supervisor comments. Fail requires a description and raises a defect. Progress is saved per item; resume any time. |
| Defects & CA | Open → Assigned → In Progress → Repair Completed → Awaiting Verification → Verified & Closed. Only supervisors/managers/admins can close, only with a passing verification, and **never the person who did the repair**. Reopen on failed verification. Overdue, critical and per-discipline views, recurring-failure flag. |
| Approvals | Configurable required disciplines per template, then a final authorized review. Blockers (pending/mandatory items, failed items, open defects, open critical defects, missing approvals) prevent final approval. Critical blockers can only be overridden by roles configured in Settings, with a written justification that is audited. |
| History | Searchable by inspection ID, WO, tag, equipment, department, date, inspector, defect ID, status, maintenance type. Equipment history: previous inspections, repeated defects, previous measured values, approvals, photos. |
| Reports | Plant readiness summary, individual inspection (PDF), department and equipment readiness, open defects, critical & overdue, CA completion (with average resolution time), inspection completion, approval history (with approval delay), repeated defects. CSV export and print/PDF. N/A is excluded from pass rates; equipment with an open critical defect is never counted as ready. |
| Admin | Users & roles (create accounts, department scope, deactivate, password reset, hand-over), devices (see every phone/PC that signed in, revoke = immediate sign-out), equipment hierarchy (department → line → equipment → sub-equipment), checklist templates with immutable versions, document/SOP library with role-based visibility, settings, audit log. |
| Offline | Firestore's persistent cache keeps data on the device; changes made offline are queued and synced. Conflicting edits are not silently overwritten: every result carries a revision and the server rejects stale ones; online saves show a "someone else updated this item" dialog. |

### Roles
System Administrator · Shift Supervisor · Department Manager · Mechanical · Electrical · Instrumentation & Control · Production Engineer/Operator · Viewer (read-only). Permissions are enforced in `firestore.rules` (see `tests/rules.test.mjs`).

## Tech stack

React 18 + TypeScript + Vite, PWA (vite-plugin-pwa), Firebase Auth + Cloud Firestore (persistent offline cache), Firebase Hosting. No backend code is needed.

**Free-plan design choices**
- Cloud Functions and (for new projects) Cloud Storage need the paid Blaze plan, so all rules live in Firestore Security Rules, admin user creation uses a secondary client app, and photos/files are compressed and stored as Firestore documents (≈100–250 KB per photo, max ≈650 KB per file). Link large manuals by URL in the document library.
- Spark quotas: 50k reads / 20k writes / 1 GiB per day-project. The app keeps the 400 newest inspections and 800 newest defects live, pages older history on demand, throttles device heartbeats and caches everything locally.
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
6. Open the site. The first visitor is asked to create the **System Administrator**. Then go to **Settings → Load example departments, equipment and checklists**, review/replace the examples, and add users under **Users**.

### Local development with emulators
```bash
echo "VITE_FIREBASE_PROJECT_ID=demo-coldrun
VITE_FIREBASE_API_KEY=demo-key
VITE_USE_EMULATORS=true" > .env.local
npx firebase emulators:start --only auth,firestore --project demo-coldrun &
npm run dev
```

### Tests
```bash
npm run typecheck
npm run test:rules   # security-rule tests on the Firestore emulator (needs Java 11+)
```

## Data model (Firestore)

`users`, `devices`, `departments`, `equipment` (with `parentId`, `line`, `templateIds`), `templates/{id}/versions/{n}` (immutable), `inspections` (header, checklist snapshot, denormalized summary, status, approvals, task `pools`) with `inspections/{id}/results/{itemId}` (one document per item), `defects`, `attachments`, `documents`, `notifications`, `audit` (append-only), `counters`, `config/settings`, `config/setup`.

## Known limitations (v1)
- PDF export uses the browser's print dialog ("Save as PDF"), which renders Arabic correctly on every device.
- Notifications are in-app; push/e-mail would need Cloud Functions (Blaze).
- Deactivated users cannot be deleted from Firebase Auth without the Admin SDK; they are blocked by the rules instead.
- The stored inspection summary is recomputed by clients after each change; if two people save at the same instant it self-heals on the next view.
