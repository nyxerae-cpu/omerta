#!/usr/bin/env node
'use strict';

const { spawn, execSync } = require('child_process');

function resolvePlaywrightModule() {
  try {
    return require.resolve('playwright');
  } catch (_) {
    // Fallback to npx cache when Playwright is not installed in package.json.
    const cmd = "find $HOME/.npm/_npx -type f -path '*/node_modules/playwright/index.js' 2>/dev/null | tail -n 1";
    const fallback = execSync(cmd, { encoding: 'utf8' }).trim();
    if (!fallback) {
      throw new Error('Playwright introuvable. Lancez: npx -y playwright install chromium');
    }
    return fallback;
  }
}

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return;
    } catch (_) {
      // Keep waiting.
    }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error('Serveur local indisponible');
}

(async () => {
  const server = spawn('python3', ['-m', 'http.server', '4173'], {
    cwd: process.cwd(),
    stdio: 'ignore',
  });

  let browser;
  try {
    await waitForServer('http://127.0.0.1:4173/index.html', 15000);

    const { chromium } = require(resolvePlaywrightModule());
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e && e.message || e)));

    const step = async (name, fn) => {
      await fn();
      console.log(`PASS: ${name}`);
    };

    await step('Load app', async () => {
      await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#home-search', { timeout: 10000 });
    });

    await step('Create project', async () => {
      await page.click('.btn-new-project');
      await page.waitForSelector('#modal-new-project:not(.hidden)', { timeout: 5000 });
      await page.fill('#new-project-name', `Smoke ${Date.now()}`);
      await page.click('#modal-new-project .btn-primary');
      await page.waitForSelector('#project-page:not(.hidden)', { timeout: 10000 });
    });

    await step('Assistant nav visible/clickable', async () => {
      const nav = page.locator('[data-section="assistant"]');
      await nav.waitFor({ state: 'visible', timeout: 10000 });
      await nav.click();
      await page.waitForSelector('#section-assistant:not(.hidden)', { timeout: 5000 });
    });

    await step('Assistant local controls', async () => {
      await page.waitForSelector('#assistant-chat-input', { timeout: 5000 });
      await page.waitForSelector('#assistant-chat', { timeout: 5000 });
    });

    await step('Timeline/Notes navigation', async () => {
      await page.click('[data-section="timeline"]');
      await page.waitForSelector('#section-timeline:not(.hidden)', { timeout: 5000 });
      await page.click('[data-section="notes"]');
      await page.waitForSelector('#section-notes:not(.hidden)', { timeout: 5000 });
    });

    if (pageErrors.length) {
      console.log('PAGE_ERRORS:', pageErrors.slice(0, 5).join(' | '));
      process.exitCode = 2;
    } else {
      console.log('PAGE_ERRORS: none');
      console.log('SMOKE_RESULT: PASS');
    }
  } catch (err) {
    console.error('SMOKE_RESULT: FAIL');
    console.error(String(err && err.stack || err));
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server && !server.killed) server.kill('SIGTERM');
  }
})();
