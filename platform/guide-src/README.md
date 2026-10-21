# User guide (PDF) sources

`public/guide/*.pdf` is generated from these files.

1. Start the emulators and serve an emulator build on port 4173, load the example data and create
   the admin `admin@kcp.iq` (the end-to-end test does this).
2. `OUT=shots node shots.mjs` — screenshots in English and Arabic.
3. Convert `shots/*.png` to `shots/*.jpg` (max width 1600 px, quality ~82).
4. `node build.mjs en ../public/guide/Cold-Run-Readiness-Guide-EN.pdf` and the same with `ar`, then
   merge the two into `Cold-Run-Readiness-Guide-EN-AR.pdf`.

Text lives in `content.mjs` (English and Arabic side by side). Needs `playwright` installed.
