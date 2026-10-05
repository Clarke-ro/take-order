import { chromium } from '../artifacts/duka/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

const SCREENSHOT_DIR = join(process.cwd(), 'tests', 'screenshots', 'baseline-desktop');
if (!existsSync(SCREENSHOT_DIR)) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
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
        imageUrls: ['https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=600&q=80'],
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

async function capture(token, fixture, viewports) {
  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: vp });
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

    await page.goto(`http://127.0.0.1:${vitePort}/o/${token}`, { waitUntil: 'networkidle' });
    // Wait for the surface to render
    await page.waitForSelector('.buyer-checkout-surface, .page-in, #buyer-item-preferences-heading', { timeout: 10000 });
    await sleep(600);

    const filename = `${token}_${vp.width}x${vp.height}.png`;
    await page.screenshot({ path: join(SCREENSHOT_DIR, filename), fullPage: true });
    console.log(`Captured ${filename}`);
    await page.close();
  }
}

const desktopViewports = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
];

try {
  await capture('test-single-item', fixtures.singleItem, desktopViewports);
  await capture('test-multi-modes', fixtures.multiItemModes, desktopViewports);
  await capture('test-received', fixtures.orderReceived, desktopViewports);
  console.log('Baseline screenshots completed successfully.');
} catch (err) {
  console.error('Error capturing screenshots:', err);
} finally {
  await browser.close();
  vite.kill('SIGINT');
  process.exit(0);
}
