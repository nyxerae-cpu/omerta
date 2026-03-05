# Smoke Test Browser

Run a quick end-to-end smoke test in headless Chromium:

```bash
node scripts/smoke-browser.js
```

What it checks:

- App loads
- Project creation works
- Citations section is reachable
- Journal section is reachable
- Timeline section is reachable
- No runtime `pageerror` in the tested path

Notes:

- The script auto-starts a local static server on port `4173`.
- If Playwright is not installed in the repo, it tries the `npx` cache fallback.
- If Chromium is missing, run:

```bash
npx -y playwright install chromium
```
