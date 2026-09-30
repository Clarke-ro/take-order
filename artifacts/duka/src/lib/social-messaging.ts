import type { Order } from '@workspace/api-client-react';

export function cleanPhoneForWhatsApp(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

export function openWhatsApp(phone: string, message: string) {
  const clean = cleanPhoneForWhatsApp(phone);
  const encoded = encodeURIComponent(message);
  const url = clean ? `https://wa.me/${clean}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function buildOrderConfirmationMessage(options: {
  order: Order;
  shopName: string;
  buyerLink?: string;
  currencySymbol: string;
}): string {
  const { order, shopName, buyerLink, currencySymbol } = options;
  const greeting = order.customerName ? `Hi ${order.customerName}!` : 'Hello!';
  const itemsText = order.items.map((item) => `• ${item.quantity}x ${item.productName}`).join('\n');
  const total = Number(order.amount).toFixed(2);
  const collected = order.status === 'paid' ? Number(order.amount) : order.status === 'deposit_paid' ? Number(order.depositAmount ?? 0) : 0;
  const balance = Math.max(0, Number(order.amount) - collected).toFixed(2);

  let paymentInfo = `Total: ${currencySymbol}${total}`;
  if (order.status === 'paid') {
    paymentInfo += ` (Paid in full ✅)`;
  } else if (order.status === 'deposit_paid') {
    paymentInfo += `\nDeposit paid: ${currencySymbol}${collected.toFixed(2)}\nBalance on delivery: ${currencySymbol}${balance}`;
  } else {
    paymentInfo += ` (Payment on delivery / Pending)`;
  }

  let text = `${greeting} 🛍️\n\nThank you for ordering with *${shopName || 'our shop'}*!\n\n*Order #${String(order.id).padStart(7, '0')}*\n${itemsText}\n\n${paymentInfo}`;

  if (order.deliveryAddress) {
    text += `\n\n📍 *Delivery to:* ${order.deliveryAddress}`;
  }

  if (buyerLink) {
    text += `\n\n🔗 *Track your order:* ${buyerLink}`;
  }

  text += `\n\nThank you for supporting small business! 🙏`;
  return text;
}

export function buildDeliveryDispatchMessage(options: {
  order: Order;
  shopName: string;
  currencySymbol: string;
  riderName?: string;
  riderPhone?: string;
}): string {
  const { order, shopName, currencySymbol, riderName, riderPhone } = options;
  const greeting = order.customerName ? `Hi ${order.customerName}!` : 'Hello!';
  const collected = order.status === 'paid' ? Number(order.amount) : order.status === 'deposit_paid' ? Number(order.depositAmount ?? 0) : 0;
  const balance = Math.max(0, Number(order.amount) - collected);

  let text = `${greeting} 🚚\n\nGreat news! Your order *#${String(order.id).padStart(7, '0')}* from *${shopName || 'our shop'}* is packed and out for delivery!`;

  if (riderName || riderPhone) {
    text += `\n\n🛵 *Rider details:* ${riderName || 'Courier'}${riderPhone ? ` (${riderPhone})` : ''}`;
  }

  if (order.deliveryAddress) {
    text += `\n📍 *Delivery address:* ${order.deliveryAddress}`;
  }

  if (balance > 0) {
    text += `\n\n💰 *Amount to pay rider on delivery:* *${currencySymbol}${balance.toFixed(2)}*`;
  } else {
    text += `\n\n✅ *Order is fully paid!* No payment needed on delivery.`;
  }

  text += `\n\nPlease keep your phone reachable so the rider can contact you upon arrival. Thank you!`;
  return text;
}

export function buildPaymentReminderMessage(options: {
  order: Order;
  shopName: string;
  currencySymbol: string;
  buyerLink?: string;
}): string {
  const { order, shopName, currencySymbol, buyerLink } = options;
  const greeting = order.customerName ? `Hi ${order.customerName}!` : 'Hello!';
  const collected = order.status === 'paid' ? Number(order.amount) : order.status === 'deposit_paid' ? Number(order.depositAmount ?? 0) : 0;
  const balance = Math.max(0, Number(order.amount) - collected).toFixed(2);

  let text = `${greeting} 👋\n\nFriendly reminder from *${shopName || 'our shop'}* regarding Order *#${String(order.id).padStart(7, '0')}*.`;
  text += `\n\n💵 *Outstanding balance due:* *${currencySymbol}${balance}*`;

  if (order.deliveryMethod === 'delivery') {
    text += ` (Due on delivery)`;
  }

  if (buyerLink) {
    text += `\n\n🔗 *View order summary:* ${buyerLink}`;
  }

  text += `\n\nKindly let us know if you need our payment details or have any questions. Thank you!`;
  return text;
}

export function buildClientBalanceReminderMessage(options: {
  clientName: string;
  balanceDue: number;
  shopName: string;
  currencySymbol: string;
}): string {
  const { clientName, balanceDue, shopName, currencySymbol } = options;
  const greeting = clientName ? `Hi ${clientName}!` : 'Hello!';
  return `${greeting} 👋\n\nHope you are having a wonderful day! Friendly reminder from *${shopName || 'our shop'}* regarding your pending balance of *${currencySymbol}${balanceDue.toFixed(2)}*.\n\nPlease let us know when it's convenient for you to settle or if you need our payment account details. Thank you! 🙏`;
}

export function buildRiderDispatchSlip(options: {
  order: Order;
  shopName: string;
  sellerPhone?: string;
  currencySymbol: string;
}): string {
  const { order, shopName, sellerPhone, currencySymbol } = options;
  const collected = order.status === 'paid' ? Number(order.amount) : order.status === 'deposit_paid' ? Number(order.depositAmount ?? 0) : 0;
  const balanceToCollect = Math.max(0, Number(order.amount) - collected);

  const itemsList = order.items.map((item) => {
    const prefsObj = (item as { preferences?: Record<string, string> }).preferences;
    const prefs = prefsObj ? Object.entries(prefsObj)
      .filter(([_, val]) => Boolean(val))
      .map(([key, val]) => `${key}: ${val}`)
      .join(', ') : '';
    return `• ${item.quantity}x ${item.productName}${prefs ? ` (${prefs})` : ''}`;
  }).join('\n');

  let slip = `📦 *DELIVERY DISPATCH SLIP*\n`;
  slip += `─────────────────────────\n`;
  slip += `*Store:* ${shopName || 'Take Order Store'}\n`;
  if (sellerPhone) slip += `*Sender Phone:* ${sellerPhone}\n`;
  slip += `*Order #:* ${String(order.id).padStart(7, '0')}\n`;
  slip += `*Date:* ${new Date(order.createdAt).toLocaleDateString()}\n\n`;

  slip += `👤 *RECIPIENT (CUSTOMER)*\n`;
  slip += `*Name:* ${order.customerName || 'Customer'}\n`;
  slip += `*Phone:* ${order.customerPhone || 'Not provided'}\n`;
  slip += `*Address:* ${order.deliveryAddress || 'Pickup / Address pending'}\n\n`;

  slip += `🛍️ *ITEMS TO DELIVER*\n`;
  slip += `${itemsList}\n\n`;

  slip += `💰 *PAYMENT TO COLLECT FROM CUSTOMER*\n`;
  if (balanceToCollect > 0) {
    slip += `👉 *COLLECT: ${currencySymbol}${balanceToCollect.toFixed(2)}*\n`;
    if (order.status === 'deposit_paid') {
      slip += `(Deposit was paid online; collect remaining balance)\n`;
    } else {
      slip += `(Cash on delivery / Pay rider)\n`;
    }
  } else {
    slip += `✅ *DO NOT COLLECT — ALREADY PAID IN FULL*\n`;
  }

  slip += `─────────────────────────\n`;
  slip += `_Handle with care. Please call customer before arrival._`;
  return slip;
}

export function buildTextReceipt(options: {
  order: Order;
  shopName: string;
  sellerHandle?: string;
  currencySymbol: string;
}): string {
  const { order, shopName, sellerHandle, currencySymbol } = options;
  const collected = order.status === 'paid' ? Number(order.amount) : order.status === 'deposit_paid' ? Number(order.depositAmount ?? 0) : 0;
  const balance = Math.max(0, Number(order.amount) - collected);

  let receipt = `🧾 *OFFICIAL RECEIPT*\n`;
  receipt += `*${shopName || 'Take Order'}* ${sellerHandle ? `(${sellerHandle})` : ''}\n`;
  receipt += `Order #${String(order.id).padStart(7, '0')} · ${new Date(order.createdAt).toLocaleDateString()}\n`;
  receipt += `Customer: ${order.customerName || 'Customer'}\n`;
  receipt += `─────────────────────────\n`;

  order.items.forEach((item) => {
    receipt += `${item.quantity}x ${item.productName} — ${currencySymbol}${(Number(item.amount)).toFixed(2)}\n`;
  });

  receipt += `─────────────────────────\n`;
  receipt += `Subtotal: ${currencySymbol}${(Number(order.amount) - Number(order.deliveryFee)).toFixed(2)}\n`;
  if (Number(order.deliveryFee) > 0) {
    receipt += `Delivery Fee: ${currencySymbol}${Number(order.deliveryFee).toFixed(2)}\n`;
  }
  receipt += `*Total: ${currencySymbol}${Number(order.amount).toFixed(2)}*\n`;
  receipt += `Amount Paid: ${currencySymbol}${collected.toFixed(2)}\n`;
  if (balance > 0) {
    receipt += `*Balance Due: ${currencySymbol}${balance.toFixed(2)}*\n`;
  } else {
    receipt += `*Status: PAID IN FULL ✅*\n`;
  }
  receipt += `─────────────────────────\n`;
  receipt += `Thank you for your business!`;

  return receipt;
}
