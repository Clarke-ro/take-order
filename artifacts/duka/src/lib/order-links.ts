export function getOrderLinkBaseUrl(): string {
  const env = (import.meta as any).env || {};
  const customBase = env.VITE_PUBLIC_ORDER_URL || env.VITE_ORDER_BASE_URL;
  if (customBase && typeof customBase === "string") {
    return customBase.replace(/\/$/, "");
  }
  return typeof window !== "undefined" ? window.location.origin : "";
}

export function buildPublicOrderLink(token: string): string {
  const base = getOrderLinkBaseUrl();
  return `${base}/o/${token}`;
}
