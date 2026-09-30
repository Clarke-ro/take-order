export type PricedCatalogItem = {
  price: number;
  stock?: number | null;
};

/**
 * The catalog summary represents the total inventory value of products in the catalog.
 * Value = sum of (price * stock) for each product on hand.
 * When stock count is omitted or null, it defaults to 1.
 * When stock is 0 (out of stock), the inventory value is 0.
 */
export function catalogValue(items: readonly PricedCatalogItem[]): number {
  return items.reduce((total, item) => {
    const stockCount = typeof item.stock === 'number' ? Math.max(0, item.stock) : 1;
    return total + (item.price * stockCount);
  }, 0);
}