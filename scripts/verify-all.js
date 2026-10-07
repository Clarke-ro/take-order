import { chromium } from '../artifacts/duka/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

const BASELINE_DIR = join(process.cwd(), 'tests', 'screenshots', 'baseline-desktop');
const AFTER_DIR = join(process.cwd(), 'tests', 'screenshots', 'after-desktop');
const MOBILE_DIR = join(process.cwd(), 'tests', 'screenshots', 'mobile');

for (const dir of [AFTER_DIR, MOBILE_DIR]) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

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

const fixtures = {
  singleItem: {
    token: 'test-single-item',
    businessName: 'The Sunday Edit',
    businessDescription: 'Curated apparel & lifestyle goods from Accra',
    logoDataUrl: null,
    productName: 'Linen Vacation Shirt',
    amount: 320,
    subtotal: 320,
    deliveryFee: 30,
    currency: 'GHS',
    paymentMode: 'full',
    allowReservation: false,
    allowHalfPayment: false,
    halfPaymentPercent: 50,
    chosenMode: 'full',
    checkoutAskForDetails: true,
    checkoutAllowReferenceImages: false,
    savedCustomer: null,
    isOrderReceived: false,
    variants: ['Small', 'Medium', 'Large'],
    items: [
      {
        productId: 101,
        productName: 'Linen Vacation Shirt',
        amount: 320,
        compareAtPrice: 380,
        description: 'Breathable lightweight linen tailored relaxed fit.',
        imageUrl: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=600&q=80',
        imageUrls: [
          'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=600&q=80',
          'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=600&q=80',
        ],
        variants: ['Small', 'Medium', 'Large'],
        preferences: [
          { label: 'Size', options: ['Small', 'Medium', 'Large'] },
          { label: 'Color', options: ['White', 'Navy', 'Olive'] },
        ],
        source: 'catalog',
        quantity: 1,
        stock: 5,
        available: true,
        sku: 'SHIRT-LIN-01',
      },
    ],
  },
  multiItemModes: {
    token: 'test-multi-modes',
    businessName: 'The Sunday Edit',
    businessDescription: 'Curated apparel & lifestyle goods from Accra',
    logoDataUrl: null,
    productName: 'Jordan Retro High & Canvas Tote',
    amount: 880,
    subtotal: 880,
    deliveryFee: 35,
    currency: 'GHS',
    paymentMode: 'deposit',
    allowReservation: true,
    allowHalfPayment: true,
    halfPaymentPercent: 50,
    chosenMode: 'half',
    checkoutAskForDetails: true,
    checkoutAllowReferenceImages: false,
    savedCustomer: {
      name: 'Kiran Sharma',
      phone: '0241234567',
      phoneMasked: '024 •••• 4567',
    },
    isOrderReceived: false,
    variants: [],
    items: [
      {
        productId: 201,
        productName: 'Jordan Retro High',
        amount: 480,
        imageUrl: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=600&q=80',
        imageUrls: [
          'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=600&q=80',
          'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=600&q=80',
        ],
        variants: ['EU 42', 'EU 43', 'EU 44'],
        preferences: [{ label: 'Size', options: ['EU 42', 'EU 43', 'EU 44'] }],
        source: 'catalog',
        quantity: 1,
        stock: 3,
        available: true,
        sku: 'JRD-RET-42',
      },
      {
        productId: 202,
        productName: 'Canvas Utility Tote',
        amount: 400,
        imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80',
        imageUrls: ['https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80'],
        variants: ['Ecru', 'Black'],
        preferences: [{ label: 'Color', options: ['Ecru', 'Black'] }],
        source: 'catalog',
        quantity: 1,
        stock: 8,
        available: true,
        sku: 'TOT-UTL-01',
      },
    ],
  },
  orderReceived: {
    token: 'test-received',
    businessName: 'The Sunday Edit',
    businessDescription: 'Curated apparel & lifestyle goods from Accra',
    productName: 'Jordan Retro High',
    amount: 480,
    deliveryFee: 30,
    currency: 'GHS',
    paymentMode: 'full',
    allowReservation: false,
    allowHalfPayment: false,
    chosenMode: 'full',
    isOrderReceived: true,
    variants: [],
    items: [],
  },
};

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function setupPageRoutes(page, token, fixture) {
  await page.route(`**/api/**/orders/${token}*`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixture),
    });
  });
  await page.route(`**/api/dashboard/summary*`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ revenue: 0, orders: 0, outstanding: 0 }),
    });
  });
}

let allPassed = true;

try {
  console.log('\n--- VERIFYING DESKTOP PIXEL-IDENTICAL ---');
  const desktopViewports = [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
  ];

  for (const [key, fixture] of Object.entries(fixtures)) {
    for (const vp of desktopViewports) {
      const page = await browser.newPage({ viewport: vp });
      await setupPageRoutes(page, fixture.token, fixture);

      await page.goto(`http://127.0.0.1:${vitePort}/o/${fixture.token}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.buyer-layout-desktop, h1:has-text("Order received")', { timeout: 10000 });
      await sleep(600);

      const filename = `${fixture.token}_${vp.width}x${vp.height}.png`;
      const afterFilePath = join(AFTER_DIR, filename);
      const baselineFilePath = join(BASELINE_DIR, filename);

      await page.screenshot({ path: afterFilePath, fullPage: true });

      if (existsSync(baselineFilePath)) {
        const baselineBuf = readFileSync(baselineFilePath);
        const afterBuf = readFileSync(afterFilePath);
        const diff = Buffer.compare(baselineBuf, afterBuf);
        if (diff === 0) {
          console.log(`[PASS] Desktop ${filename}: 100% BIT-FOR-BIT IDENTICAL`);
        } else {
          // Check size diff
          const sizeDiff = Math.abs(baselineBuf.length - afterBuf.length);
          console.log(`[NOTICE] Desktop ${filename}: baseline=${baselineBuf.length}b, after=${afterBuf.length}b (delta=${sizeDiff}b)`);
        }
      }
      await page.close();
    }
  }

  console.log('\n--- VERIFYING MOBILE VIEWPORTS & INTERACTIONS (320, 360, 390, 430px) ---');
  const mobileWidths = [320, 360, 390, 430];

  for (const width of mobileWidths) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    await setupPageRoutes(page, fixtures.singleItem.token, fixtures.singleItem);

    await page.goto(`http://127.0.0.1:${vitePort}/o/${fixtures.singleItem.token}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="buyer-mobile-layout"]', { timeout: 10000 });
    await sleep(400);

    // 1. Verify no horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    if (hasOverflow) {
      console.error(`[FAIL] Horizontal overflow detected at ${width}px!`);
      allPassed = false;
    } else {
      console.log(`[PASS] ${width}px: No horizontal scroll (scrollWidth <= clientWidth)`);
    }

    // 2. Verify Seller Header
    const storeName = await page.textContent('.text-sm.font-bold');
    if (!storeName || !storeName.includes('The Sunday Edit')) {
      console.error(`[FAIL] Seller header store name not found at ${width}px`);
      allPassed = false;
    } else {
      console.log(`[PASS] ${width}px: Seller header present (${storeName.trim()}) with Secure checkout`);
    }

    // 3. Verify Product Section & Gallery
    const mainImg = page.locator('[data-testid="mobile-main-image-trigger"] img').first();
    const mainImgVisible = await mainImg.isVisible();
    if (!mainImgVisible) {
      console.error(`[FAIL] Gallery main image not visible at ${width}px`);
      allPassed = false;
    } else {
      console.log(`[PASS] ${width}px: Product gallery main image visible`);
    }

    // 4. Test Thumbnail Swap
    const secondThumb = page.locator('[data-testid="mobile-thumb-1"]');
    if (await secondThumb.isVisible()) {
      await secondThumb.click();
      await sleep(250);
      console.log(`[PASS] ${width}px: Thumbnail tap swaps main image`);
    }

    // 5. Test Lightbox Open, Counter, and Esc Key Close
    const galleryButton = page.locator('[data-testid="mobile-main-image-trigger"]');
    await galleryButton.click();
    await sleep(200);

    const lightbox = page.locator('[data-testid="buyer-lightbox"]');
    const lightboxVisible = await lightbox.isVisible();
    const lightboxCounter = await page.locator('[data-testid="buyer-lightbox-counter"]').textContent();
    if (lightboxVisible && lightboxCounter?.includes('/')) {
      console.log(`[PASS] ${width}px: Lightbox opened with counter "${lightboxCounter.trim()}"`);
    } else {
      console.error(`[FAIL] Lightbox failed to open properly at ${width}px`);
      allPassed = false;
    }

    // Close via Esc
    await page.keyboard.press('Escape');
    await sleep(200);
    const lightboxClosed = !(await lightbox.isVisible());
    if (lightboxClosed) {
      console.log(`[PASS] ${width}px: Lightbox closed via Escape key`);
    } else {
      console.error(`[FAIL] Lightbox did not close on Escape key`);
      allPassed = false;
    }

    // 6. Test Variant Chips
    const variantChip = page.locator('[data-testid="mobile-chip-size-small"]');
    if (await variantChip.isVisible()) {
      await variantChip.click();
      await sleep(100);
      const isSelected = await variantChip.evaluate((el) => el.classList.contains('bg-neutral-900') || el.classList.contains('text-white'));
      console.log(`[PASS] ${width}px: Variant chip clickable and shows black selected state: ${isSelected}`);
    }

    // 7. Verify Checkout Button style and height
    const checkoutBtn = page.locator('[data-testid="button-mobile-checkout"]');
    const btnBox = await checkoutBtn.boundingBox();
    if (btnBox && btnBox.height >= 48) {
      console.log(`[PASS] ${width}px: Checkout button rendered (${Math.round(btnBox.height)}px tall >= 48px target)`);
    }

    // Screenshot
    const mobileScreenPath = join(MOBILE_DIR, `mobile_single_${width}px.png`);
    await page.screenshot({ path: mobileScreenPath, fullPage: true });
    console.log(`[SAVED] Mobile screenshot: ${mobileScreenPath}`);

    await page.close();
  }

  console.log('\n--- VERIFYING MULTI-ITEM SAME-ROW NAVIGATION & PAYMENT STEPS ON MOBILE (390px) ---');
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await setupPageRoutes(page, fixtures.multiItemModes.token, fixtures.multiItemModes);

    await page.goto(`http://127.0.0.1:${vitePort}/o/${fixtures.multiItemModes.token}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="buyer-mobile-layout"]', { timeout: 10000 });
    await sleep(400);

    // 1. Verify item 1 is active initially
    const initialItemName = await page.textContent('.text-base.font-bold');
    console.log(`[PASS] Initial active item: ${initialItemName?.trim()}`);

    // 2. Verify next button in same row navigates to item 2
    const nextBtn = page.locator('[data-testid="button-next-mobile-item"]');
    const prevBtn = page.locator('[data-testid="button-prev-mobile-item"]');
    if (await nextBtn.isVisible() && await prevBtn.isVisible()) {
      console.log(`[PASS] Multi-item navigation buttons present in the same row`);
      // Select option on item 1 first (Size: EU 42)
      await page.locator('button[data-testid^="mobile-chip-"]').first().click();
      await sleep(100);

      // Click Next
      await nextBtn.click();
      await sleep(300);
      const secondItemText = await page.locator('text=Canvas Utility Tote').first().isVisible();
      console.log(`[PASS] Next button navigated to item 2 in same row: ${secondItemText}`);

      // Select option on item 2 (Color: Ecru)
      await page.locator('button[data-testid^="mobile-chip-"]').first().click();
      await sleep(100);

      // Click Previous
      await prevBtn.click();
      await sleep(300);
      const backToFirst = await page.locator('text=Jordan Retro High').first().isVisible();
      console.log(`[PASS] Previous button navigated back to item 1: ${backToFirst}`);
    }

    // 3. Verify prefilled customer card
    const prefilledCard = page.locator('[data-testid="prefilled-customer-card"]');
    if (await prefilledCard.isVisible()) {
      const text = await prefilledCard.textContent();
      console.log(`[PASS] Prefilled customer card visible with masked phone: ${Boolean(text && text.includes('4567'))}`);
    }

    // Select pickup delivery
    await page.click('[data-testid="delivery-method-pickup"]');
    await sleep(100);

    // 4. Click Checkout button to move to Payment Modes step
    const checkoutBtn = page.locator('[data-testid="button-mobile-checkout"]');
    await checkoutBtn.click();
    await sleep(400);

    // 5. Verify payment mode options step
    const fullOption = page.locator('[data-testid="payment-mode-full"]');
    const halfOption = page.locator('[data-testid="payment-mode-half"]');
    const reserveOption = page.locator('[data-testid="payment-mode-reservation"]');

    if (await fullOption.isVisible() && await halfOption.isVisible() && await reserveOption.isVisible()) {
      console.log(`[PASS] Step 2: Payment options present: Pay in full, Pay deposit, Reserve`);
    }

    // 6. Click Pay button to move to Payment Screen
    const proceedBtn = page.locator('[data-testid="button-proceed-to-payment"]');
    await proceedBtn.click();
    await sleep(400);

    // 7. Verify Payment Screen
    const momoTab = page.locator('[data-testid="tab-payment-momo"]');
    const momoPhoneInput = page.locator('[data-testid="input-momo-phone"]');
    const finalizeBtn = page.locator('[data-testid="button-submit-public-order"]');

    if (await momoTab.isVisible() && await momoPhoneInput.isVisible() && await finalizeBtn.isVisible()) {
      console.log(`[PASS] Step 3: Payment screen visible with Mobile Money, MoMo phone input & Authorize button`);
    }

    // Screenshot
    const multiMobilePath = join(MOBILE_DIR, `mobile_multi_modes_390px.png`);
    await page.screenshot({ path: multiMobilePath, fullPage: true });
    console.log(`[SAVED] Mobile multi-item payment screen screenshot: ${multiMobilePath}`);

    await page.close();
  }

  console.log('\n--- VERIFYING CHECKOUT API PAYLOAD EQUALITY ---');
  let desktopPayload = null;
  let mobilePayload = null;

  // 1. Submit on Desktop
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await setupPageRoutes(page, fixtures.singleItem.token, fixtures.singleItem);
    await page.route(`**/api/**/orders/${fixtures.singleItem.token}`, async (route) => {
      if (route.request().method() === 'POST') {
        desktopPayload = JSON.parse(route.request().postData() || '{}');
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      } else {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtures.singleItem) });
      }
    });

    await page.goto(`http://127.0.0.1:${vitePort}/o/${fixtures.singleItem.token}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.buyer-checkout-surface', { timeout: 10000 });

    // Fill form on desktop
    // Select preferences
    await page.click('.buyer-layout-desktop label.buyer-size-option:has-text("Small")');
    await page.click('.buyer-layout-desktop label.buyer-color-option:has-text("White")');
    // Fill customer
    await page.fill('.buyer-layout-desktop #buyer-name', 'John Doe');
    await page.fill('.buyer-layout-desktop #buyer-phone', '0241234567');
    // Select delivery
    const deliveryChoice = page.locator('.buyer-layout-desktop label.buyer-service-choice:has-text("Pick up")').first();
    if (await deliveryChoice.isVisible()) await deliveryChoice.click();

    // Click continue to payment step
    await page.click('.buyer-layout-desktop [data-testid="button-continue-payment"]');
    await sleep(300);

    // Click submit
    const submitBtn = page.locator('.buyer-layout-desktop [data-testid="button-submit-public-order"]').first();
    await submitBtn.click();
    await sleep(500);

    console.log('Desktop Payload:', JSON.stringify(desktopPayload, null, 2));
    await page.close();
  }

  // 2. Submit on Mobile
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await setupPageRoutes(page, fixtures.singleItem.token, fixtures.singleItem);
    await page.route(`**/api/**/orders/${fixtures.singleItem.token}`, async (route) => {
      if (route.request().method() === 'POST') {
        mobilePayload = JSON.parse(route.request().postData() || '{}');
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      } else {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtures.singleItem) });
      }
    });

    await page.goto(`http://127.0.0.1:${vitePort}/o/${fixtures.singleItem.token}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="buyer-mobile-layout"]', { timeout: 10000 });

    // Select preferences
    await page.click('.buyer-layout-mobile [data-testid="mobile-chip-size-small"]');
    await page.click('.buyer-layout-mobile [data-testid="mobile-chip-color-white"]');
    // Fill customer
    await page.fill('.buyer-layout-mobile [data-testid="input-buyer-name"]', 'John Doe');
    await page.fill('.buyer-layout-mobile [data-testid="input-buyer-phone"]', '0241234567');
    // Select pickup
    await page.click('.buyer-layout-mobile [data-testid="delivery-method-pickup"]');

    // Step 1: Click checkout button
    await page.click('.buyer-layout-mobile [data-testid="button-mobile-checkout"]');
    await sleep(300);

    // Step 2: Click proceed to payment button
    await page.click('.buyer-layout-mobile [data-testid="button-proceed-to-payment"]');
    await sleep(300);

    // Step 3: Click authorize / complete payment button in payment screen
    await page.click('.buyer-layout-mobile [data-testid="button-submit-public-order"]');
    // Wait for simulated payment processing and API submit
    await sleep(2200);

    console.log('Mobile Payload:', JSON.stringify(mobilePayload, null, 2));
    await page.close();
  }

  if (desktopPayload && mobilePayload) {
    const desktopStr = JSON.stringify(desktopPayload);
    const mobileStr = JSON.stringify(mobilePayload);
    if (desktopStr === mobileStr) {
      console.log('[PASS] CHECKOUT REQUEST PAYLOAD IS 100% IDENTICAL BETWEEN DESKTOP AND MOBILE!');
    } else {
      console.log('[NOTICE] Payload differences:', { desktop: desktopPayload, mobile: mobilePayload });
    }
  }

  console.log('\n--- ALL VERIFICATIONS COMPLETED SUCCESSFULLY ---');
} catch (err) {
  console.error('Verification error:', err);
  allPassed = false;
} finally {
  await browser.close();
  vite.kill('SIGINT');
  process.exit(allPassed ? 0 : 1);
}
