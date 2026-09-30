import { type Request } from "express";

export function formatCurrencyPrice(amount: number, currencyCode: string = "GHS"): string {
  const code = (currencyCode || "GHS").toUpperCase().trim();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

export function isCrawlerRequest(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  return /facebookexternalhit|whatsapp|facebot|twitterbot|telegrambot|slackbot|discordbot|linkedinbot|applebot|pinterest|googlebot|bingbot|baiduspider|yandex|vkshare|w3c_validator|skypeuripreview|qwantify|bitlybot|tumblr/i.test(
    userAgent,
  );
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function resolveAbsoluteImageUrl(
  rawUrl: string | null | undefined,
  baseUrl: string,
): string {
  const fallbackUrl = `${baseUrl.replace(/\/$/, "")}/branding/takeorder-wave.png`;
  if (!rawUrl || typeof rawUrl !== "string") {
    return fallbackUrl;
  }
  const trimmed = rawUrl.trim();
  // Reject base64 data URIs — crawlers do not reliably load inline base64
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return fallbackUrl;
  }
  // Absolute HTTPS URL
  if (trimmed.startsWith("https://")) {
    return trimmed;
  }
  // Upgrade HTTP to HTTPS (unless localhost)
  if (trimmed.startsWith("http://")) {
    if (trimmed.includes("localhost") || trimmed.includes("127.0.0.1")) {
      return trimmed;
    }
    return `https://${trimmed.slice(7)}`;
  }
  // Protocol-relative
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  // Host-relative
  if (trimmed.startsWith("/")) {
    return `${baseUrl.replace(/\/$/, "")}${trimmed}`;
  }
  return fallbackUrl;
}

export function renderOrderPreviewHtml(options: {
  order: {
    token: string;
    productName: string;
    amount: string | number;
  };
  items: Array<{
    productName: string;
    amount: string | number;
    imageUrls?: string[] | null;
  }>;
  sellerBusinessName?: string | null;
  currency?: string | null;
  productImageUrl?: string | null;
  baseUrl: string;
  destinationUrl: string;
  isCrawler: boolean;
}): string {
  const {
    order,
    items,
    sellerBusinessName,
    currency = "GHS",
    productImageUrl,
    baseUrl,
    destinationUrl,
    isCrawler,
  } = options;

  const businessName = sellerBusinessName?.trim() || "Take Order Store";
  const totalAmount = Number(order.amount) || 0;
  const formattedPrice = formatCurrencyPrice(totalAmount, currency || "GHS");

  const itemsCount = items.length;
  let ogTitle: string;
  if (itemsCount > 1) {
    ogTitle = `${itemsCount} items from ${businessName} — ${formattedPrice}`;
  } else {
    const pName = items[0]?.productName?.trim() || order.productName?.trim() || "Order";
    ogTitle = `${pName} — ${formattedPrice} · ${businessName}`;
  }

  const ogDescription = `Complete your order from ${businessName}.`;

  // First item photo, fallback to product photo, fallback to brand asset
  const rawImage = items[0]?.imageUrls?.[0] || productImageUrl || null;
  const ogImage = resolveAbsoluteImageUrl(rawImage, baseUrl);
  const canonicalUrl = `${baseUrl.replace(/\/$/, "")}/o/${order.token}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(ogTitle)}</title>
  <meta name="description" content="${escapeHtml(ogDescription)}" />

  <!-- Open Graph / Facebook / Instagram / WhatsApp / iMessage -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:title" content="${escapeHtml(ogTitle)}" />
  <meta property="og:description" content="${escapeHtml(ogDescription)}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(ogImage)}" />
  <meta property="og:image:alt" content="${escapeHtml(ogTitle)}" />
  <meta property="og:site_name" content="Take Order" />

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${escapeHtml(canonicalUrl)}" />
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />

  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />

  ${
    !isCrawler
      ? `
  <!-- Human Visitor Instant Redirect / Hydration -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(destinationUrl)}" />
  <script>
    window.location.replace(${JSON.stringify(destinationUrl)});
  </script>
  `
      : ""
  }

  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #fafafa;
      color: #0f172a;
      margin: 0;
      padding: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .preview-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 28px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 10px 30px -10px rgba(0,0,0,0.08);
    }
    .preview-img {
      width: 100%;
      height: 220px;
      object-fit: cover;
      border-radius: 14px;
      margin-bottom: 20px;
      background: #f1f5f9;
    }
    .preview-title {
      font-size: 18px;
      font-weight: 700;
      line-height: 1.3;
      margin: 0 0 8px;
    }
    .preview-desc {
      font-size: 14px;
      color: #64748b;
      margin: 0 0 20px;
    }
    .preview-btn {
      display: inline-block;
      width: 100%;
      padding: 12px 20px;
      background: #000000;
      color: #ffffff;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      border-radius: 12px;
      transition: background 0.2s;
    }
    .preview-btn:hover {
      background: #1e293b;
    }
    .spinner {
      width: 24px;
      height: 24px;
      border: 3px solid #e2e8f0;
      border-top-color: #000000;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="preview-card">
    ${!isCrawler ? '<div class="spinner"></div>' : ""}
    <img src="${escapeHtml(ogImage)}" alt="${escapeHtml(ogTitle)}" class="preview-img" />
    <h1 class="preview-title">${escapeHtml(ogTitle)}</h1>
    <p class="preview-desc">${escapeHtml(ogDescription)}</p>
    <a href="${escapeHtml(destinationUrl)}" class="preview-btn">Complete your order</a>
  </div>
</body>
</html>`;
}

export function renderNotFoundPreviewHtml(baseUrl: string): string {
  const fallbackUrl = `${baseUrl.replace(/\/$/, "")}/branding/takeorder-wave.png`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Order Not Found · Take Order</title>
  <meta property="og:title" content="Order Not Found · Take Order" />
  <meta property="og:description" content="This order link is unavailable or has expired." />
  <meta property="og:image" content="${escapeHtml(fallbackUrl)}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #fafafa;
      color: #0f172a;
      margin: 0;
      padding: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 32px;
      max-width: 400px;
      width: 100%;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1 style="font-size: 20px; font-weight: 700; margin: 0 0 8px;">Order not found</h1>
    <p style="font-size: 14px; color: #64748b; margin: 0;">This order link could not be found or may have expired.</p>
  </div>
</body>
</html>`;
}
