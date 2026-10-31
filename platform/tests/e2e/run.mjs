// Runs every end-to-end suite against the Firebase emulators (started by `npm run test:e2e`).
// Order matters: coldrun.mjs builds the data (accounts, equipment, a full cold run) the others use.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { preview } from 'vite';

const SUITES = ['coldrun', 'admin', 'members', 'checklist', 'session', 'users', 'flicker', 'layers'];
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const server = await preview({ preview: { port: 4173, strictPort: true, host: '127.0.0.1' }, build: { outDir: 'dist-e2e' }, logLevel: 'warn' });
const results = [];
try {
  for (const s of SUITES) {
    console.log(`\n=== ${s} ===`);
    // async, so this process keeps serving the app while the suite runs
    const code = await new Promise(res => spawn(process.execPath, [new URL(`./${s}.mjs`, import.meta.url).pathname], { stdio: 'inherit', env: { ...process.env, OUT, BASE_URL: 'http://127.0.0.1:4173/' } }).on('exit', res));
    results.push([s, code === 0]);
  }
} finally {
  await new Promise(r => server.httpServer.close(r));
}
console.log('\n' + results.map(([s, ok]) => `${ok ? 'PASS' : 'FAIL'}  ${s}`).join('\n'));
process.exit(results.every(([, ok]) => ok) ? 0 : 1);
