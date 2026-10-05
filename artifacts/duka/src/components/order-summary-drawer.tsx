import React, { useId } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { moneyExact, channelName } from '@/lib/formatters';
import { getOrderCollectedAmount, getOrderOutstandingAmount, type Order } from '@workspace/api-zod';
import { DollarSign, ShoppingBag, CheckCircle, Clock, Truck, CircleDollarSign } from 'lucide-react';

export interface OrderSummaryDrawerProps {
  open?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  orders: Order[];
  filterLabel?: string;
  activeFilterLabel?: string;
  searchQuery?: string;
  currencySymbol?: string;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

export function OrderSummaryDrawer({
  open,
  isOpen,
  onOpenChange,
  onClose,
  orders,
  filterLabel,
  activeFilterLabel,
  searchQuery,
  currencySymbol,
  triggerRef,
}: OrderSummaryDrawerProps) {
  const isSheetOpen = open ?? isOpen ?? false;
  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange?.(nextOpen);
    if (!nextOpen) {
      onClose?.();
      triggerRef?.current?.focus();
    }
  };
  const activeLabel = filterLabel ?? activeFilterLabel ?? 'All';
  const totalOrders = orders.length;
  const totalOrderValue = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
  const totalCollected = orders.reduce((sum, o) => sum + getOrderCollectedAmount(o), 0);
  const outstandingBalance = orders.reduce((sum, o) => sum + getOrderOutstandingAmount(o), 0);

  // Fulfillment counts
  const toShipCount = orders.filter((o) => o.fulfillment === 'pending').length;
  const shippedCount = orders.filter((o) => o.fulfillment === 'shipped').length;
  const deliveredCount = orders.filter((o) => o.fulfillment === 'delivered').length;

  // Payment counts
  const paidCount = orders.filter((o) => o.status === 'paid').length;
  const depositCount = orders.filter((o) => o.status === 'deposit_paid').length;
  const reservedCount = orders.filter((o) => o.status === 'reserved').length;

  // Channel breakdown
  const channelData = React.useMemo(() => {
    const map = new Map<string, { count: number; totalValue: number }>();
    for (const o of orders) {
      const ch = o.channel || 'direct';
      const existing = map.get(ch) || { count: 0, totalValue: 0 };
      existing.count += 1;
      existing.totalValue += o.amount || 0;
      map.set(ch, existing);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].totalValue - a[1].totalValue);
  }, [orders]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <Sheet open={isSheetOpen} onOpenChange={handleOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className="w-full sm:max-w-lg overflow-y-auto max-h-[85vh] sm:max-h-full p-6 bg-white dark:bg-neutral-900 border-[#E3E3EC] dark:border-neutral-800"
      >
        <SheetHeader className="mb-5 text-left">
          <SheetTitle className="text-[20px] font-semibold text-[#111827] dark:text-neutral-100">
            Order summary
          </SheetTitle>
          <SheetDescription className="text-[13px] text-[#6B7280] dark:text-neutral-400">
            Reflecting filter:{' '}
            <strong className="text-[#111827] dark:text-neutral-200">{activeLabel}</strong>
            {searchQuery?.trim() ? (
              <>
                {' '}
                · search: &ldquo;<strong className="text-[#111827] dark:text-neutral-200">{searchQuery.trim()}</strong>&rdquo;
              </>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Top Key Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-[12px] border border-[#E3E3EC] dark:border-neutral-800 bg-white dark:bg-neutral-950">
              <span className="text-[12px] font-medium text-[#6B7280] dark:text-neutral-400 uppercase tracking-wider block">
                Total Orders
              </span>
              <span className="text-[28px] font-semibold text-[#111827] dark:text-neutral-100 mt-1 block">
                {totalOrders}
              </span>
            </div>

            <div className="p-4 rounded-[12px] border border-[#E3E3EC] dark:border-neutral-800 bg-white dark:bg-neutral-950">
              <span className="text-[12px] font-medium text-[#6B7280] dark:text-neutral-400 uppercase tracking-wider block">
                Order Value
              </span>
              <span
                className="text-[20px] sm:text-[22px] font-semibold text-[#111827] dark:text-neutral-100 mt-1 block truncate font-mono-ui"
                title={moneyExact(totalOrderValue)}
              >
                {moneyExact(totalOrderValue)}
              </span>
            </div>

            <div className="p-4 rounded-[12px] border border-[#E3E3EC] dark:border-neutral-800 bg-white dark:bg-neutral-950">
              <span className="text-[12px] font-medium text-[#6B7280] dark:text-neutral-400 uppercase tracking-wider block">
                Total Collected
              </span>
              <span
                className="text-[20px] sm:text-[22px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1 block truncate font-mono-ui"
                title={moneyExact(totalCollected)}
              >
                {moneyExact(totalCollected)}
              </span>
            </div>

            <div className="p-4 rounded-[12px] border border-[#E3E3EC] dark:border-neutral-800 bg-white dark:bg-neutral-950">
              <span className="text-[12px] font-medium text-[#6B7280] dark:text-neutral-400 uppercase tracking-wider block">
                Outstanding
              </span>
              <span
                className="text-[20px] sm:text-[22px] font-semibold text-amber-600 dark:text-amber-400 mt-1 block truncate font-mono-ui"
                title={moneyExact(outstandingBalance)}
              >
                {moneyExact(outstandingBalance)}
              </span>
            </div>
          </div>

          {/* Fulfillment Status breakdown */}
          <div>
            <h3 className="text-[13.5px] font-semibold text-[#111827] dark:text-neutral-100 mb-2.5">
              By Fulfillment Status
            </h3>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 rounded-[10px] border border-[#E3E3EC] dark:border-neutral-800 bg-white dark:bg-neutral-950">
                <span className="text-[11.5px] text-[#6B7280] dark:text-neutral-400 block truncate">
                  To ship
                </span>
                <span className="text-[18px] font-semibold text-[#111827] dark:text-neutral-100 mt-0.5 block">
                  {toShipCount}
                </span>
              </div>
              <div className="p-3 rounded-[10px] border border-[#E3E3EC] dark:border-neutral-800 bg-white dark:bg-neutral-950">
                <span className="text-[11.5px] text-[#6B7280] dark:text-neutral-400 block truncate">
                  Shipped
                </span>
                <span className="text-[18px] font-semibold text-[#111827] dark:text-neutral-100 mt-0.5 block">
                  {shippedCount}
                </span>
              </div>
              <div className="p-3 rounded-[10px] border border-[#E3E3EC] dark:border-neutral-800 bg-white dark:bg-neutral-950">
                <span className="text-[11.5px] text-[#6B7280] dark:text-neutral-400 block truncate">
                  Delivered
                </span>
                <span className="text-[18px] font-semibold text-[#111827] dark:text-neutral-100 mt-0.5 block">
                  {deliveredCount}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Status breakdown */}
          <div>
            <h3 className="text-[13.5px] font-semibold text-[#111827] dark:text-neutral-100 mb-2.5">
              By Payment Status
            </h3>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 rounded-[10px] border border-[#E3E3EC] dark:border-neutral-800 bg-white dark:bg-neutral-950">
                <span className="text-[11.5px] text-[#6B7280] dark:text-neutral-400 block truncate">
                  Paid in full
                </span>
                <span className="text-[18px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                  {paidCount}
                </span>
              </div>
              <div className="p-3 rounded-[10px] border border-[#E3E3EC] dark:border-neutral-800 bg-white dark:bg-neutral-950">
                <span className="text-[11.5px] text-[#6B7280] dark:text-neutral-400 block truncate">
                  Deposit paid
                </span>
                <span className="text-[18px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5 block">
                  {depositCount}
                </span>
              </div>
              <div className="p-3 rounded-[10px] border border-[#E3E3EC] dark:border-neutral-800 bg-white dark:bg-neutral-950">
                <span className="text-[11.5px] text-[#6B7280] dark:text-neutral-400 block truncate">
                  Reserved / Unpaid
                </span>
                <span className="text-[18px] font-semibold text-[#111827] dark:text-neutral-100 mt-0.5 block">
                  {reservedCount}
                </span>
              </div>
            </div>
          </div>

          {/* Traffic Channel breakdown */}
          <div>
            <h3 className="text-[13.5px] font-semibold text-[#111827] dark:text-neutral-100 mb-2.5">
              By Traffic Channel
            </h3>
            <div className="space-y-2">
              {channelData.map(([channel, data]) => (
                <div
                  key={channel}
                  className="flex items-center justify-between p-3 rounded-[10px] border border-[#E3E3EC] dark:border-neutral-800 bg-white dark:bg-neutral-950 text-[13.5px]"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#111827] dark:text-neutral-100">
                      {channelName(channel)}
                    </span>
                    <span className="text-xs text-[#6B7280] dark:text-neutral-400">
                      ({data.count} {data.count === 1 ? 'order' : 'orders'})
                    </span>
                  </div>
                  <span className="font-mono-ui font-medium text-[#111827] dark:text-neutral-200">
                    {moneyExact(data.totalValue)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
