import assert from "node:assert/strict";
import test from "node:test";
import { blankProduct, calculateProfitAndMargin, resolveStockStatus } from "../App";

test("blankProduct starts with unselected category and empty fields", () => {
  assert.equal(blankProduct.category, "", "Category must not auto-fill with a default category");
  assert.equal(blankProduct.name, "");
  assert.equal(blankProduct.price, "");
  assert.equal(blankProduct.cost, "");
  assert.equal(blankProduct.stock, "0");
  assert.deepEqual(blankProduct.images, []);
});

test("calculateProfitAndMargin calculates gross profit and margin percentage accurately", () => {
  // Profitable scenario
  const profitCase = calculateProfitAndMargin("100", "60");
  assert.equal(profitCase.hasPricingInfo, true);
  assert.equal(profitCase.hasCostInfo, true);
  assert.equal(profitCase.grossProfit, 40);
  assert.equal(profitCase.marginPercent, 40);

  // High margin scenario
  const highMargin = calculateProfitAndMargin("250", "50");
  assert.equal(highMargin.grossProfit, 200);
  assert.equal(highMargin.marginPercent, 80);

  // Breakeven scenario
  const breakeven = calculateProfitAndMargin("85", "85");
  assert.equal(breakeven.grossProfit, 0);
  assert.equal(breakeven.marginPercent, 0);

  // Negative margin / loss scenario
  const lossCase = calculateProfitAndMargin("40", "60");
  assert.equal(lossCase.grossProfit, -20);
  assert.equal(lossCase.marginPercent, -50);

  // Zero cost scenario (e.g. digital goods or pure margin)
  const zeroCost = calculateProfitAndMargin("150", "0");
  assert.equal(zeroCost.hasCostInfo, true);
  assert.equal(zeroCost.grossProfit, 150);
  assert.equal(zeroCost.marginPercent, 100);

  // Missing cost scenario
  const missingCost = calculateProfitAndMargin("120", "");
  assert.equal(missingCost.hasPricingInfo, true);
  assert.equal(missingCost.hasCostInfo, false);
  assert.equal(missingCost.grossProfit, null);
  assert.equal(missingCost.marginPercent, null);

  // Missing price scenario
  const missingPrice = calculateProfitAndMargin("", "45");
  assert.equal(missingPrice.hasPricingInfo, false);
  assert.equal(missingPrice.grossProfit, null);
  assert.equal(missingPrice.marginPercent, null);
});

test("resolveStockStatus categorizes stock counts into correct inventory tones", () => {
  // Out of stock
  const zeroStock = resolveStockStatus(0);
  assert.equal(zeroStock.label, "Out of stock");
  assert.equal(zeroStock.tone, "neutral");
  assert.equal(zeroStock.quantity, 0);

  const zeroStrStock = resolveStockStatus("0");
  assert.equal(zeroStrStock.label, "Out of stock");
  assert.equal(zeroStrStock.tone, "neutral");

  const invalidStock = resolveStockStatus("invalid");
  assert.equal(invalidStock.label, "Out of stock");
  assert.equal(invalidStock.tone, "neutral");

  const negativeStock = resolveStockStatus("-5");
  assert.equal(negativeStock.label, "Out of stock");
  assert.equal(negativeStock.tone, "neutral");

  // Low stock (1 - 4)
  const oneStock = resolveStockStatus("1");
  assert.equal(oneStock.label, "Low stock");
  assert.equal(oneStock.tone, "gold");
  assert.equal(oneStock.quantity, 1);

  const fourStock = resolveStockStatus(4);
  assert.equal(fourStock.label, "Low stock");
  assert.equal(fourStock.tone, "gold");
  assert.equal(fourStock.quantity, 4);

  // In stock (>= 5)
  const fiveStock = resolveStockStatus(5);
  assert.equal(fiveStock.label, "In stock");
  assert.equal(fiveStock.tone, "mint");
  assert.equal(fiveStock.quantity, 5);

  const bulkStock = resolveStockStatus("120");
  assert.equal(bulkStock.label, "In stock");
  assert.equal(bulkStock.tone, "mint");
  assert.equal(bulkStock.quantity, 120);
});

test("multi-image list operations support setting primary cover and removal", () => {
  const initialImages = [
    "https://example.com/img1.jpg",
    "https://example.com/img2.jpg",
    "https://example.com/img3.jpg",
  ];

  // Making image at index 1 the primary cover photo
  const setPrimary = (list: string[], index: number) => {
    if (index === 0 || index >= list.length) return list;
    return [list[index], ...list.filter((_, i) => i !== index)];
  };

  const reordered = setPrimary(initialImages, 1);
  assert.deepEqual(reordered, [
    "https://example.com/img2.jpg",
    "https://example.com/img1.jpg",
    "https://example.com/img3.jpg",
  ]);

  // Removing image at index 2
  const removeAt = (list: string[], index: number) => list.filter((_, i) => i !== index);
  const afterDelete = removeAt(reordered, 2);
  assert.deepEqual(afterDelete, [
    "https://example.com/img2.jpg",
    "https://example.com/img1.jpg",
  ]);

  // Appending additional photo
  const afterAppend = [...afterDelete, "https://example.com/img4.jpg"];
  assert.equal(afterAppend.length, 3);
  assert.equal(afterAppend[0], "https://example.com/img2.jpg");
  assert.equal(afterAppend[2], "https://example.com/img4.jpg");
});

test("take-order catalog empty state prompt contains actions to add product or take custom item", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const appSrc = fs.readFileSync(path.resolve(currentDir, "../App.tsx"), "utf8");

  assert.match(appSrc, /data-testid="catalog-empty-prompt"/);
  assert.match(appSrc, /No products in your catalog yet/);
  assert.match(appSrc, /data-testid="button-catalog-empty-add-product"/);
  assert.match(appSrc, /Add a new product/);
  assert.match(appSrc, /data-testid="button-catalog-empty-custom-item"/);
  assert.match(appSrc, /Take a custom product/);
});

