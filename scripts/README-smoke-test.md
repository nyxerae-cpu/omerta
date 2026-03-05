# Smoke Test Browser

Run a quick end-to-end smoke test in headless Chromium:

```bash
node scripts/smoke-browser.js
```

What it checks:

- App loads
- Project creation works
- Sidebar navigation is visible/clickable (`assistant`)
- Assistant chat controls exist (mode local)
- Timeline and Notes sections are reachable
- No runtime `pageerror` in the tested path

Notes:

- The script auto-starts a local static server on port `4173`.
- If Playwright is not installed in the repo, it tries the `npx` cache fallback.
- If Chromium is missing, run:

```bash
npx -y playwright install chromium
```
