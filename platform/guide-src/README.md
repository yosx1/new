# User guide (PDF) sources

`public/guide/*.pdf` is generated from these files. Text lives in `content.mjs` (English and Arabic side by side);
`plant.svg` is the plant skyline of the sign-in page (exported from `src/components/PlantScene.tsx`) used on the cover.

1. From `platform/`: `npm run build:e2e`, start the emulators (`npx firebase emulators:start --only auth,firestore --project demo-coldrun`)
   and serve the build (`npx vite preview --outDir dist-e2e --port 4173`).
2. `OUT=<dir> node tests/e2e/coldrun.mjs` — creates the accounts, the equipment and a full cold run.
3. From `guide-src/`: `OUT=shots-new CSV=<dir>/upload.csv node shots.mjs` — screenshots in English and Arabic.
4. Convert `shots-new/*.png` to `shots/*.jpg` (max width 1600 px, quality ~82).
5. `node build.mjs en ../public/guide/Cold-Run-Readiness-Guide-EN.pdf` and the same with `ar`, then merge the two
   into `Cold-Run-Readiness-Guide-EN-AR.pdf` (English pages first).
