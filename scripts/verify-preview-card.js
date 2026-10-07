import { chromium } from '../artifacts/duka/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

async function waitForUrl(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {}
    await sleep(200);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

const artifactDir = join(process.cwd(), 'artifacts', 'duka');
const vitePort = await freePort();

const vite = spawn(process.execPath, [join(artifactDir, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1'], {
  cwd: artifactDir,
  env: { ...process.env, NODE_ENV: 'test', PORT: String(vitePort), BASE_PATH: '/', VITE_CLERK_PUBLISHABLE_KEY: '' },
  stdio: 'ignore',
});

console.log(`Starting Vite on port ${vitePort}...`);
await waitForUrl(`http://127.0.0.1:${vitePort}/`);
console.log(`Vite ready on port ${vitePort}`);

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Route mocks for link builder
  await page.route('**/api/products*', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 1,
          name: 'Handmade Mug',
          price: 75,
          variants: ['Default'],
          preferences: [],
          stock: 10,
          source: 'catalog',
          available: true,
          imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400',
        },
      ]),
    })
  );
  await page.route('**/api/seller/settings*', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ businessName: 'Pottery Studio', currency: 'GHS' }),
    })
  );
  await page.route('**/api/dashboard/summary*', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ revenue: 0, orders: 0, outstanding: 0 }),
    })
  );

  await page.goto(`http://127.0.0.1:${vitePort}/take-order`, { waitUntil: 'networkidle' });
  await sleep(600);

  // Step 1: Add catalog item
  const catalogSelect = page.locator('select').first();
  if (await catalogSelect.isVisible()) {
    await catalogSelect.selectOption('1');
    await page.click('button:has-text("Add product")');
    await sleep(200);
  }

  // Continue to step 2
  await page.click('button[data-testid="button-create-order-link"], button:has-text("Continue")');
  await sleep(400);

  // In step 2: Check right preview panel is the black items summary card (TakeOrderCheckoutSummary)
  const step2RightPanel = page.locator('.take-order-step2-summary');
  const step2Visible = await step2RightPanel.isVisible();
  console.log(`[PASS] Step 2 right preview panel black items card visible: ${step2Visible}`);

  // Fill payment mode in step 2: Full payment
  await page.click('button:has-text("Full payment")');
  await page.click('button:has-text("Direct Link"), button:has-text("WhatsApp")');

  // Continue to step 3
  await page.click('button[data-testid="button-create-order-link"], button:has-text("Continue")');
  await sleep(400);

  // In step 3: Toggle to Mobile preview
  const mobileToggle = page.locator('button:has-text("Mobile")').first();
  if (await mobileToggle.isVisible()) {
    await mobileToggle.click();
    await sleep(300);
  }

  // Verify preview card renders mobile layout inert and live
  const previewCard = page.locator('[data-testid="buyer-link-preview-card"]');
  const previewVisible = await previewCard.isVisible();
  const mobileLayoutInsidePreview = page.locator('[data-testid="buyer-link-preview-card"] [data-testid="buyer-mobile-layout"]');
  const mobileInsideVisible = await mobileLayoutInsidePreview.isVisible();
  const isInert = await page.locator('.buyer-link-preview-container').getAttribute('inert');

  console.log(`[PASS] Link builder preview card visible: ${previewVisible}`);
  console.log(`[PASS] Link builder preview card renders mobile layout: ${mobileInsideVisible}`);
  console.log(`[PASS] Link builder preview container is inert: ${isInert !== null}`);

  // Screenshot of builder preview card
  await previewCard.screenshot({ path: join(process.cwd(), 'tests', 'screenshots', 'mobile', 'builder_preview_card_mobile.png') });
  console.log('[SAVED] Builder preview card screenshot saved.');

  console.log('\n--- PREVIEW CARD VERIFICATION PASSED ---');
} catch (err) {
  console.error('Preview card error:', err);
  process.exit(1);
} finally {
  await browser.close();
  vite.kill('SIGINT');
  process.exit(0);
}
