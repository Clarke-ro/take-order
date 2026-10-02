import type { Order } from '@workspace/api-client-react';

/**
 * Escape formula injection characters for CSV cells (=, +, -, @)
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value == null) return '';
  let str = String(value).trim();
  // Protect against formula injection in spreadsheet apps
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  // If contains commas, double quotes, or newlines, quote and escape double quotes
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatIsoDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format channel display name
 */
function channelDisplayName(ch: string | null | undefined): string {
  if (!ch) return 'Direct';
  const c = String(ch).toLowerCase();
  if (c === 'whatsapp') return 'WhatsApp';
  if (c === 'tiktok') return 'TikTok';
  if (c === 'facebook') return 'Facebook';
  if (c === 'instagram') return 'Instagram';
  if (c === 'x' || c === 'twitter') return 'X';
  return String(ch).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Generate UTF-8 CSV with BOM for orders
 */
export function generateOrdersCsv(orders: Order[], currencySymbolStr = 'GH₵'): string {
  const headers = [
    'Order ID',
    'Customer',
    'Item',
    'Delivery method',
    'Traffic channel',
    `Order value (${currencySymbolStr})`,
    `Collected (${currencySymbolStr})`,
    `Outstanding (${currencySymbolStr})`,
    'Payment status',
    'Fulfillment status',
    'Date placed',
  ];

  const rows = orders.map((order) => {
    const isAwaiting =
      !order.customerPhone &&
      (!order.customerName ||
        order.customerName.toLowerCase() === 'waiting for buyer' ||
        order.customerName.toLowerCase() === 'buyer pending');

    const customer = isAwaiting ? 'Awaiting' : (order.customerName || 'Awaiting');
    const item = order.productName || '';
    const deliveryMethod = order.deliveryMethod === 'delivery' ? 'Delivery' : order.deliveryMethod === 'pickup' ? 'Pickup' : 'Standard';
    const trafficChannel = channelDisplayName(order.channel);
    const orderValue = Number(order.amount || 0).toFixed(2);
    const collectedVal =
      order.status === 'paid'
        ? order.amount
        : order.status === 'deposit_paid'
        ? (order.depositAmount ?? 0)
        : 0;
    const collected = Number(collectedVal || 0).toFixed(2);
    const outstandingVal = Math.max(0, (order.amount || 0) - collectedVal);
    const outstanding = Number(outstandingVal || 0).toFixed(2);

    const paymentStatus =
      order.status === 'paid'
        ? 'Paid in full'
        : order.status === 'deposit_paid'
        ? 'Deposit paid'
        : order.status === 'reserved'
        ? 'Reserved'
        : 'Awaiting payment';

    const fulfillmentStatus =
      order.fulfillment === 'pending'
        ? 'To ship'
        : order.fulfillment === 'shipped'
        ? 'Shipped'
        : order.fulfillment === 'delivered'
        ? 'Delivered'
        : 'To ship';

    const datePlaced = formatIsoDate(order.createdAt);

    return [
      sanitizeCsvCell(`#${String(order.id).padStart(7, '0')}`),
      sanitizeCsvCell(customer),
      sanitizeCsvCell(item),
      sanitizeCsvCell(deliveryMethod),
      sanitizeCsvCell(trafficChannel),
      sanitizeCsvCell(orderValue),
      sanitizeCsvCell(collected),
      sanitizeCsvCell(outstanding),
      sanitizeCsvCell(paymentStatus),
      sanitizeCsvCell(fulfillmentStatus),
      sanitizeCsvCell(datePlaced),
    ].join(',');
  });

  // UTF-8 BOM
  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

/**
 * Trigger download of CSV file in the browser
 */
export function downloadCsvFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
