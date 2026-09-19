type PricedCatalogItem = {
  price: number;
};

/**
 * The catalog summary represents the sum of the prices shown on catalog items.
 * Stock quantity is tracked separately and must not change this displayed value.
 */
export function catalogValue(items: readonly PricedCatalogItem[]): number {
  return items.reduce((total, item) => total + item.price, 0);
}