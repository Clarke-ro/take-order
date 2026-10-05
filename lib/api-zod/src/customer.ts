/**
 * Standard customer placeholder used when an order link has no customer assigned yet.
 */
export const WAITING_FOR_BUYER = "Waiting for buyer";

/**
 * Checks whether a given customer name string represents the awaiting/unassigned state.
 */
export function isAwaitingBuyer(name: string | null | undefined): boolean {
  if (!name) return true;
  const normalized = name.trim().toLowerCase();
  return (
    normalized === "waiting for buyer" ||
    normalized === "buyer pending" ||
    normalized === "awaiting buyer" ||
    normalized === "customer"
  );
}
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length <= 4) return trimmed;
  const last4 = digits.slice(-4);
  return `••• ••• ${last4}`;
}

export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes('@')) return '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `••@${domain}`;
  return `${local[0]}•••${local[local.length - 1]}@${domain}`;
}
