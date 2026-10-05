/**
 * Shared payment mode utilities and amount calculation logic.
 * Server is the authority for allowed modes, percentages, and amounts.
 * All amount calculations use integer pesewas (rounded to the nearest pesewa, remainder on balance).
 */

export type PaymentModeChoice = 'full' | 'half' | 'reservation';

export interface PaymentCalculationResult {
  totalPesewas: number;
  dueNowPesewas: number;
  balancePesewas: number;
  dueNowAmount: number;
  balanceAmount: number;
}

/**
 * Calculate due now and balance in integer pesewas given total in pesewas and percent.
 * Any rounding remainder remains on the balance.
 */
export function calculatePaymentAmounts(totalPesewas: number, percent: number): PaymentCalculationResult {
  const safeTotalPesewas = Math.max(0, Math.round(totalPesewas));
  const safePercent = Math.min(99, Math.max(1, Math.round(percent)));
  const dueNowPesewas = Math.round((safeTotalPesewas * safePercent) / 100);
  const balancePesewas = safeTotalPesewas - dueNowPesewas;

  return {
    totalPesewas: safeTotalPesewas,
    dueNowPesewas,
    balancePesewas,
    dueNowAmount: Number((dueNowPesewas / 100).toFixed(2)),
    balanceAmount: Number((balancePesewas / 100).toFixed(2)),
  };
}

/**
 * Determine allowed payment modes for an order/link.
 * Full payment is always allowed.
 * For new links: enabled via allowReservation / allowHalfPayment switches.
 * For legacy links: preserves existing paymentMode ('reserve' -> reservation, 'deposit' -> half).
 */
export function getAllowedModesForLink(order: {
  allowReservation?: boolean | null;
  allowHalfPayment?: boolean | null;
  paymentMode?: string | null;
}): Set<PaymentModeChoice> {
  const modes = new Set<PaymentModeChoice>(['full']);

  const isNewLinkConfig = order.allowReservation !== null && order.allowReservation !== undefined ||
    order.allowHalfPayment !== null && order.allowHalfPayment !== undefined;

  if (isNewLinkConfig) {
    if (order.allowReservation === true) {
      modes.add('reservation');
    }
    if (order.allowHalfPayment === true) {
      modes.add('half');
    }
  } else {
    // Legacy link fallback
    if (order.paymentMode === 'reserve') {
      modes.add('reservation');
    } else if (order.paymentMode === 'deposit') {
      modes.add('half');
    }
  }

  return modes;
}

export type OrderAmountSource = {
  status?: string | null;
  amount?: number | string | null;
  depositAmount?: number | string | null;
  amountDueNow?: number | string | null;
};

/**
 * Canonical helper to compute collected amount across the entire app.
 * Replaces all ad-hoc copies of the collected amount rule.
 */
export function getOrderCollectedAmount(order: OrderAmountSource | null | undefined): number {
  if (!order) return 0;
  if (order.status === 'paid') {
    const amt = Number(order.amount);
    return Number.isFinite(amt) ? amt : 0;
  }
  if (order.status === 'deposit_paid') {
    const collected = order.amountDueNow != null
      ? Number(order.amountDueNow)
      : order.depositAmount != null
        ? Number(order.depositAmount)
        : 0;
    return Number.isFinite(collected) ? Math.max(0, collected) : 0;
  }
  return 0;
}

/**
 * Canonical helper to compute outstanding amount across the entire app.
 * Outstanding = total amount - collected amount (clamped to 0).
 */
export function getOrderOutstandingAmount(order: OrderAmountSource | null | undefined): number {
  if (!order) return 0;
  const total = Number(order.amount) || 0;
  if (order.status === 'paid') {
    return 0;
  }
  if (order.status === 'deposit_paid') {
    const collected = getOrderCollectedAmount(order);
    return Math.max(0, total - collected);
  }
  return Math.max(0, total);
}
