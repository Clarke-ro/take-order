import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml,
  formatCurrencyPrice,
  isCrawlerRequest,
  renderNotFoundPreviewHtml,
  renderOrderPreviewHtml,
  resolveAbsoluteImageUrl,
} from "./link-preview.js";

describe("link-preview", () => {
  it("formats currency prices accurately", () => {
    const ghs = formatCurrencyPrice(450, "GHS");
    assert.ok(ghs.includes("450.00"));

    const usd = formatCurrencyPrice(29.99, "USD");
    assert.ok(usd.includes("29.99"));
    assert.ok(usd.includes("$"));

    const eur = formatCurrencyPrice(100, "EUR");
    assert.ok(eur.includes("100.00"));
  });

  it("detects social media link crawlers", () => {
    // WhatsApp crawler user agent
    assert.equal(isCrawlerRequest("WhatsApp/2.21.12.21 i"), true);
    // Facebook / Instagram crawler
    assert.equal(isCrawlerRequest("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"), true);
    // Twitter crawler
    assert.equal(isCrawlerRequest("Twitterbot/1.0"), true);
    // Telegram crawler
    assert.equal(isCrawlerRequest("TelegramBot (like TwitterBot)"), true);
    // Slack crawler
    assert.equal(isCrawlerRequest("Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)"), true);
    // Discord crawler
    assert.equal(isCrawlerRequest("Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)"), true);
    // Applebot
    assert.equal(isCrawlerRequest("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15 (Applebot/0.1)"), true);

    // Standard human browsers
    assert.equal(isCrawlerRequest("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"), false);
    assert.equal(isCrawlerRequest("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"), false);
    assert.equal(isCrawlerRequest(undefined), false);
  });

  it("resolves absolute image URLs and rejects base64 data URIs", () => {
    const base = "https://api.takeorder.app";

    // Valid HTTPS url
    assert.equal(
      resolveAbsoluteImageUrl("https://supabase.co/storage/v1/product.jpg", base),
      "https://supabase.co/storage/v1/product.jpg",
    );

    // Relative url
    assert.equal(
      resolveAbsoluteImageUrl("/uploads/item.png", base),
      "https://api.takeorder.app/uploads/item.png",
    );

    // Base64 data URI must fall back to branded preview image
    assert.equal(
      resolveAbsoluteImageUrl("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...", base),
      "https://api.takeorder.app/branding/takeorder-wave.png",
    );

    // Null/undefined falls back to branded preview image
    assert.equal(
      resolveAbsoluteImageUrl(null, base),
      "https://api.takeorder.app/branding/takeorder-wave.png",
    );
  });

  it("generates single-item order preview with correct Open Graph and Twitter tags", () => {
    const html = renderOrderPreviewHtml({
      order: {
        token: "tok_123",
        productName: "Vintage Silk Shirt",
        amount: 250,
      },
      items: [
        {
          productName: "Vintage Silk Shirt",
          amount: 250,
          imageUrls: ["https://images.example.com/shirt.jpg"],
        },
      ],
      sellerBusinessName: "Amina's Boutique",
      currency: "GHS",
      baseUrl: "https://takeorder.app",
      destinationUrl: "https://takeorder.app/o/tok_123",
      isCrawler: true,
    });

    assert.ok(html.includes('<meta property="og:title" content="Vintage Silk Shirt — '));
    assert.ok(html.includes("Amina&#39;s Boutique"));
    assert.ok(html.includes('<meta property="og:description" content="Complete your order from Amina&#39;s Boutique."'));
    assert.ok(html.includes('<meta property="og:image" content="https://images.example.com/shirt.jpg"'));
    assert.ok(html.includes('<meta property="og:url" content="https://takeorder.app/o/tok_123"'));
    assert.ok(html.includes('<meta property="og:type" content="website"'));
    assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image"'));
    assert.ok(html.includes('<meta name="twitter:image" content="https://images.example.com/shirt.jpg"'));
    assert.ok(html.includes("<title>Vintage Silk Shirt — "));
    // Ensure crawler receives no redirect script
    assert.equal(html.includes("window.location.replace"), false);
  });

  it("generates multi-item order summary title and uses first item photo", () => {
    const html = renderOrderPreviewHtml({
      order: {
        token: "tok_multi",
        productName: "Bundle Order",
        amount: 500,
      },
      items: [
        {
          productName: "Product A",
          amount: 200,
          imageUrls: ["https://images.example.com/product-a.jpg"],
        },
        {
          productName: "Product B",
          amount: 300,
          imageUrls: ["https://images.example.com/product-b.jpg"],
        },
      ],
      sellerBusinessName: "Studio Style",
      currency: "USD",
      baseUrl: "https://takeorder.app",
      destinationUrl: "https://takeorder.app/o/tok_multi",
      isCrawler: true,
    });

    assert.ok(html.includes('<meta property="og:title" content="2 items from Studio Style — '));
    assert.ok(html.includes("$500.00"));
    assert.ok(html.includes('<meta property="og:image" content="https://images.example.com/product-a.jpg"'));
  });

  it("includes client redirect for human browser visitors", () => {
    const html = renderOrderPreviewHtml({
      order: {
        token: "tok_human",
        productName: "Sneakers",
        amount: 150,
      },
      items: [
        {
          productName: "Sneakers",
          amount: 150,
        },
      ],
      sellerBusinessName: "Kicks Store",
      currency: "GHS",
      baseUrl: "https://takeorder.app",
      destinationUrl: "https://takeorder.app/o/tok_human",
      isCrawler: false,
    });

    assert.ok(html.includes('window.location.replace("https://takeorder.app/o/tok_human")'));
    assert.ok(html.includes('<meta http-equiv="refresh" content="0;url=https://takeorder.app/o/tok_human"'));
  });

  it("escapes special characters to prevent HTML/XSS injection", () => {
    const escaped = escapeHtml('<script>alert("hack & test")</script>');
    assert.equal(escaped, "&lt;script&gt;alert(&quot;hack &amp; test&quot;)&lt;/script&gt;");
  });
});
