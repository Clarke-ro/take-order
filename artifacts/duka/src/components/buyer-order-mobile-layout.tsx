import React, { useState, useRef, useMemo } from 'react';
import type { PublicOrder, PublicOrderItem } from '@workspace/api-client-react';
import {
  Lock,
  Check,
  CheckCircle2,
  AlertCircle,
  Truck,
  ArrowRight,
  ArrowUpRight,
  ImagePlus,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BuyerImageViewer } from './buyer-image-viewer';
import { moneyExact } from '@/lib/formatters';
import { maskPhone } from '@workspace/api-zod';
import type { BuyerOrderFormValues, BuyerItemFormValues } from '@/hooks/use-buyer-order-state';

export function SellerLogo({
  businessName,
  logoDataUrl,
  className = '',
}: {
  businessName: string;
  logoDataUrl?: string | null;
  className?: string;
}) {
  if (logoDataUrl) {
    return (
      <img
        src={logoDataUrl}
        alt={`${businessName} logo`}
        className={cn('h-10 w-10 rounded-[10px] object-cover border border-[hsl(var(--border))]', className)}
      />
    );
  }
  const initials = (businessName || 'Shop')
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
  return (
    <span
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-[10px] bg-neutral-900 text-white font-bold text-xs shrink-0',
        className
      )}
      role="img"
      aria-label={`${businessName} graphic logo`}
    >
      <span>{initials}</span>
    </span>
  );
}

export interface BuyerOrderMobileLayoutProps {
  order: PublicOrder;
  form: BuyerOrderFormValues;
  itemForms: BuyerItemFormValues[];
  changeField: (key: 'name' | 'phone' | 'deliveryMethod' | 'address' | 'orderDetails' | 'details', value: string) => void;
  changeItemPreference: (itemIndex: number, label: string, option: string) => void;
  changeItemQuantity: (itemIndex: number, quantity: number) => void;
  changeItemDetails: (itemIndex: number, details: string) => void;
  changeItemImage: (itemIndex: number, file: File) => void;
  isEditingCustomer: boolean;
  onEditCustomer: () => void;
  chosenMode: 'full' | 'half' | 'reservation';
  onChosenModeChange: (mode: 'full' | 'half' | 'reservation') => void;
  allowedModes: Set<'full' | 'half' | 'reservation'>;
  orderSubtotal: number;
  buyerDeliveryFee: number;
  buyerTotal: number;
  effectivePercent: number;
  halfCalc: { dueNowAmount: number; balanceAmount: number };
  dueNow: number;
  balanceRemaining: number;
  submitError: string;
  submitPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onProceedToPayment?: () => void;
}

export function BuyerOrderMobileLayout({
  order,
  form,
  itemForms,
  changeField,
  changeItemPreference,
  changeItemQuantity,
  changeItemDetails,
  changeItemImage,
  isEditingCustomer,
  onEditCustomer,
  chosenMode,
  onChosenModeChange,
  allowedModes,
  orderSubtotal,
  buyerDeliveryFee,
  buyerTotal,
  effectivePercent,
  halfCalc,
  dueNow,
  balanceRemaining,
  submitError,
  submitPending,
  onSubmit,
  onProceedToPayment,
}: BuyerOrderMobileLayoutProps) {
  // Lightbox state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerTitle, setViewerTitle] = useState('');

  // Gallery active index for primary item
  const [activeMainImageIndex, setActiveMainImageIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const primaryItem: PublicOrderItem | undefined = order.items?.[0];

  const primaryImages: string[] = useMemo(() => {
    if (!primaryItem) return [];
    if (primaryItem.imageUrls && primaryItem.imageUrls.length > 0) return primaryItem.imageUrls;
    if ((primaryItem as any).imageUrl) return [(primaryItem as any).imageUrl];
    return [];
  }, [primaryItem]);

  const activeMainImage = primaryImages[activeMainImageIndex] || primaryImages[0] || '';

  const handleSelectThumbnail = (index: number) => {
    if (index === activeMainImageIndex) return;
    setIsFading(true);
    setTimeout(() => {
      setActiveMainImageIndex(index);
      setIsFading(false);
    }, 150);
  };

  const handleSwipeStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleSwipeEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null || primaryImages.length < 2) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(deltaX) > 35) {
      if (deltaX < 0) {
        // Swipe left -> next
        handleSelectThumbnail((activeMainImageIndex + 1) % primaryImages.length);
      } else {
        // Swipe right -> prev
        handleSelectThumbnail((activeMainImageIndex - 1 + primaryImages.length) % primaryImages.length);
      }
    }
  };

  const openLightbox = (images: string[], index: number, title: string) => {
    setViewerImages(images);
    setViewerIndex(index);
    setViewerTitle(title);
    setViewerOpen(true);
  };

  const selectedDeliveryMethod = form.deliveryMethod ?? (order.deliveryFee === 0 ? 'pickup' : undefined);

  // Phone prefix default
  const defaultPrefix = useMemo(() => {
    switch (order.currency) {
      case 'GHS': return '+233 ';
      case 'NGN': return '+234 ';
      case 'KES': return '+254 ';
      case 'ZAR': return '+27 ';
      case 'USD':
      case 'CAD': return '+1 ';
      case 'GBP': return '+44 ';
      default: return '+233 ';
    }
  }, [order.currency]);

  const isFormValidToPay = useMemo(() => {
    // Check required options on each item
    for (let i = 0; i < (order.items || []).length; i++) {
      const itm = order.items[i];
      const f = itemForms[i];
      if (itm.preferences && itm.preferences.length > 0) {
        for (const pref of itm.preferences) {
          if (!f?.preferences?.[pref.label]) return false;
        }
      }
    }
    // Check contact if not saved
    const isSaved = Boolean(order.savedCustomer && !isEditingCustomer);
    if (!isSaved) {
      if (!form.name?.trim()) return false;
      if (!form.phone?.trim() || form.phone.trim().length < 5) return false;
    }
    // Check delivery
    if (!selectedDeliveryMethod) return false;
    if (selectedDeliveryMethod === 'delivery' && !form.address?.trim()) return false;

    return true;
  }, [order.items, order.savedCustomer, isEditingCustomer, itemForms, form, selectedDeliveryMethod]);

  return (
    <div className="w-full max-w-[430px] mx-auto px-4 py-4 space-y-4 font-sans text-[hsl(var(--foreground))] select-text">
      {/* 1. SELLER HEADER */}
      <header className="flex items-center justify-between pb-1 border-b border-[hsl(var(--border))]">
        <div className="flex items-center gap-2.5 min-w-0">
          <SellerLogo
            businessName={order.businessName}
            logoDataUrl={order.logoDataUrl ?? undefined}
            className="h-8 w-8 rounded-full shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight truncate text-[hsl(var(--foreground))]">
              {order.businessName}
            </h1>
            {order.businessDescription && (
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">
                {order.businessDescription}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 text-[11px] font-medium text-[hsl(var(--muted-foreground))] shrink-0 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-full">
          <Lock size={11} className="text-emerald-600 dark:text-emerald-400" />
          <span>Secure checkout</span>
        </div>
      </header>

      {/* 2. PRODUCT SECTION (white card, 16px radius) */}
      <section className="rounded-[16px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-4 shadow-xs space-y-4">
        {/* Gallery for first item */}
        {primaryImages.length > 0 && (
          <div className="space-y-2">
            <div
              className="relative aspect-square w-full overflow-hidden rounded-[12px] bg-neutral-100 dark:bg-neutral-800 cursor-pointer"
              onTouchStart={handleSwipeStart}
              onTouchEnd={handleSwipeEnd}
              onClick={() => openLightbox(primaryImages, activeMainImageIndex, primaryItem?.productName || 'Product')}
              data-testid="mobile-main-image-trigger"
            >
              <img
                src={activeMainImage}
                alt={`${primaryItem?.productName || 'Product'} view ${activeMainImageIndex + 1}`}
                className={`h-full w-full object-cover transition-opacity duration-150 ${
                  isFading ? 'opacity-0' : 'opacity-100'
                }`}
              />

              {/* Page dots indicator */}
              {primaryImages.length > 1 && (
                <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/50 backdrop-blur-xs">
                  {primaryImages.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${
                        i === activeMainImageIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Thumbnail strip (about 56px each) */}
            {primaryImages.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto py-1">
                {primaryImages.map((thumb, idx) => (
                  <button
                    key={`${thumb}-${idx}`}
                    type="button"
                    onClick={() => handleSelectThumbnail(idx)}
                    aria-label={`Select product image ${idx + 1}`}
                    className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition cursor-pointer ${
                      idx === activeMainImageIndex
                        ? 'border-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary))]'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={thumb} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Primary item title & price */}
        {primaryItem && (
          <div className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-base font-bold text-[hsl(var(--foreground))] leading-snug">
                {primaryItem.productName}
              </h2>
              <div className="text-base font-extrabold text-[hsl(var(--foreground))] font-mono-ui shrink-0">
                {moneyExact(primaryItem.amount)}
              </div>
            </div>
            {primaryItem.description && (
              <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 leading-relaxed">
                {primaryItem.description}
              </p>
            )}
            {primaryItem.stock != null && (
              <div className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
                {primaryItem.available === false ? (
                  <span className="text-rose-500 font-semibold">Out of stock</span>
                ) : (
                  <span>{primaryItem.stock} in stock</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. OPTIONS AND PREFERENCES FOR ALL ITEMS */}
        <div className="space-y-4 pt-2 border-t border-[hsl(var(--border))]">
          {order.items.map((item, itemIdx) => {
            const f = itemForms[itemIdx];
            const isAdditionalItem = itemIdx > 0;
            const itemImages = item.imageUrls?.length
              ? item.imageUrls
              : (item as any).imageUrl
                ? [(item as any).imageUrl]
                : [];

            return (
              <div
                key={item.productId || itemIdx}
                className={isAdditionalItem ? 'p-3 rounded-[12px] bg-neutral-50 dark:bg-neutral-800/40 border border-[hsl(var(--border))] space-y-3' : 'space-y-3'}
              >
                {/* Compact row header for additional items */}
                {isAdditionalItem && (
                  <div className="flex items-center gap-3">
                    {itemImages[0] ? (
                      <button
                        type="button"
                        onClick={() => openLightbox(itemImages, 0, item.productName)}
                        aria-label={`View photo for ${item.productName}`}
                        className="relative h-12 w-12 rounded-lg overflow-hidden shrink-0 border border-[hsl(var(--border))] cursor-pointer"
                      >
                        <img src={itemImages[0]} alt="" className="h-full w-full object-cover" />
                      </button>
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center shrink-0 text-xs font-bold">
                        {item.productName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-[hsl(var(--foreground))] truncate">
                        {item.productName}
                      </div>
                      <div className="text-xs font-semibold text-[hsl(var(--foreground))] font-mono-ui">
                        {moneyExact(item.amount)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Variants / Preferences */}
                {item.preferences && item.preferences.length > 0 && (
                  <div className="space-y-2.5">
                    {item.preferences.map((pref) => {
                      const selectedVal = f?.preferences?.[pref.label];
                      const isMissing = Boolean(submitError && !selectedVal);

                      return (
                        <div key={pref.label} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-[hsl(var(--foreground))]">
                              {pref.label} <b className="text-rose-500 font-bold ml-0.5">*</b>
                            </span>
                            {selectedVal && (
                              <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                                {selectedVal}
                              </span>
                            )}
                          </div>

                          {/* Chips */}
                          <div className="flex flex-wrap gap-2">
                            {pref.options.map((opt) => {
                              const isSelected = selectedVal === opt;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => changeItemPreference(itemIdx, pref.label, opt)}
                                  className={`min-h-[44px] px-3.5 py-1.5 rounded-full text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                                    isSelected
                                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold shadow-xs'
                                      : 'bg-neutral-100 dark:bg-neutral-800 text-[hsl(var(--foreground))] hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-[hsl(var(--border))]'
                                  }`}
                                  data-testid={`mobile-chip-${pref.label.toLowerCase()}-${opt.toLowerCase()}`}
                                >
                                  {isSelected && <Check size={12} strokeWidth={2.5} />}
                                  <span>{opt}</span>
                                </button>
                              );
                            })}
                          </div>

                          {isMissing && (
                            <div className="text-[11px] font-semibold text-rose-500 flex items-center gap-1">
                              <AlertCircle size={12} />
                              <span>Please select an option for {pref.label}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Quantity */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-semibold text-[hsl(var(--foreground))]">Quantity</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={(f?.quantity || 1) <= 1}
                      onClick={() => changeItemQuantity(itemIdx, Math.max(1, (f?.quantity || 1) - 1))}
                      aria-label="Decrease quantity"
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-neutral-100 dark:bg-neutral-800 text-sm font-bold disabled:opacity-40 cursor-pointer"
                    >
                      −
                    </button>
                    <span className="min-w-6 text-center text-sm font-bold font-mono-ui">
                      {f?.quantity || 1}
                    </span>
                    <button
                      type="button"
                      disabled={item.source === 'catalog' && (f?.quantity || 1) >= (item.stock ?? 999)}
                      onClick={() => changeItemQuantity(itemIdx, (f?.quantity || 1) + 1)}
                      aria-label="Increase quantity"
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-neutral-100 dark:bg-neutral-800 text-sm font-bold disabled:opacity-40 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Custom reference image upload */}
                {item.source === 'custom' && order.checkoutAllowReferenceImages !== false && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-xs font-semibold text-[hsl(var(--foreground))]">
                      Reference image <b className="text-rose-500 font-bold ml-0.5">*</b>
                    </span>
                    <label className="flex items-center justify-center gap-2 p-3 rounded-[10px] border border-dashed border-[hsl(var(--border))] bg-neutral-50 dark:bg-neutral-800/40 text-xs text-[hsl(var(--muted-foreground))] cursor-pointer min-h-[44px]">
                      <ImagePlus size={16} />
                      <span>{f?.image ? 'Change photo' : 'Upload photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) changeItemImage(itemIdx, file);
                        }}
                      />
                    </label>
                    {f?.imagePreview && (
                      <img
                        src={f.imagePreview}
                        alt="Reference preview"
                        className="h-20 w-20 rounded-lg object-cover border border-[hsl(var(--border))]"
                      />
                    )}
                  </div>
                )}

                {/* Item note */}
                <div className="space-y-1">
                  <label htmlFor={`mobile-item-note-${itemIdx}`} className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                    Note for seller (optional)
                  </label>
                  <textarea
                    id={`mobile-item-note-${itemIdx}`}
                    value={f?.details || ''}
                    onChange={(e) => changeItemDetails(itemIdx, e.target.value)}
                    placeholder="Specific request for this item..."
                    rows={2}
                    className="w-full rounded-[10px] border border-[hsl(var(--border))] bg-neutral-50 dark:bg-neutral-800/50 p-2.5 text-[16px] sm:text-xs leading-normal resize-none focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. YOUR DETAILS (buyer contact card) */}
      <section className="rounded-[16px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-4 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            Your details
          </h2>
          {order.savedCustomer && !isEditingCustomer && (
            <button
              type="button"
              onClick={onEditCustomer}
              className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline cursor-pointer"
              data-testid="mobile-button-edit-customer"
            >
              Edit
            </button>
          )}
        </div>

        {order.savedCustomer && !isEditingCustomer ? (
          <div className="rounded-[10px] border border-[hsl(var(--border))] bg-neutral-50 dark:bg-neutral-800/40 p-3 space-y-1">
            <div className="text-sm font-semibold text-[hsl(var(--foreground))]">
              {order.savedCustomer.name}
            </div>
            {order.savedCustomer.phone && (
              <div className="text-xs font-mono text-[hsl(var(--muted-foreground))]">
                {maskPhone(order.savedCustomer.phone)}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label htmlFor="mobile-buyer-name" className="text-xs font-semibold text-[hsl(var(--foreground))] block mb-1">
                Name <b className="text-rose-500 font-bold ml-0.5">*</b>
              </label>
              <input
                id="mobile-buyer-name"
                data-testid="input-buyer-name"
                value={form.name}
                onChange={(e) => changeField('name', e.target.value)}
                placeholder="Full name"
                className="w-full h-11 px-3.5 rounded-[10px] border border-[hsl(var(--border))] bg-neutral-50 dark:bg-neutral-800/50 text-[16px] sm:text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
              />
            </div>

            <div>
              <label htmlFor="mobile-buyer-phone" className="text-xs font-semibold text-[hsl(var(--foreground))] block mb-1">
                Phone number <b className="text-rose-500 font-bold ml-0.5">*</b>
              </label>
              <input
                id="mobile-buyer-phone"
                data-testid="input-buyer-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => changeField('phone', e.target.value)}
                placeholder={defaultPrefix}
                className="w-full h-11 px-3.5 rounded-[10px] border border-[hsl(var(--border))] bg-neutral-50 dark:bg-neutral-800/50 text-[16px] sm:text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
              />
            </div>
          </div>
        )}

        {/* Delivery Service Selection */}
        <div className="space-y-2 pt-2 border-t border-[hsl(var(--border))]">
          <span className="text-xs font-semibold text-[hsl(var(--foreground))] block">
            Delivery service <b className="text-rose-500 font-bold ml-0.5">*</b>
          </span>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => changeField('deliveryMethod', 'pickup')}
              className={`p-3 rounded-[10px] border text-left transition cursor-pointer min-h-[44px] ${
                selectedDeliveryMethod === 'pickup'
                  ? 'border-[hsl(var(--primary))] bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                  : 'border-[hsl(var(--border))] bg-neutral-50 dark:bg-neutral-800/50 text-[hsl(var(--foreground))]'
              }`}
            >
              <div className="text-xs font-bold">Pick up</div>
              <div className={`text-[11px] ${selectedDeliveryMethod === 'pickup' ? 'opacity-90' : 'text-[hsl(var(--muted-foreground))]'}`}>
                Free
              </div>
            </button>

            <button
              type="button"
              onClick={() => changeField('deliveryMethod', 'delivery')}
              className={`p-3 rounded-[10px] border text-left transition cursor-pointer min-h-[44px] ${
                selectedDeliveryMethod === 'delivery'
                  ? 'border-[hsl(var(--primary))] bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                  : 'border-[hsl(var(--border))] bg-neutral-50 dark:bg-neutral-800/50 text-[hsl(var(--foreground))]'
              }`}
            >
              <div className="text-xs font-bold">Delivery</div>
              <div className={`text-[11px] ${selectedDeliveryMethod === 'delivery' ? 'opacity-90' : 'text-[hsl(var(--muted-foreground))]'}`}>
                {order.deliveryFee > 0 ? moneyExact(order.deliveryFee) : 'Free'}
              </div>
            </button>
          </div>

          {/* Delivery Address Field */}
          {selectedDeliveryMethod === 'delivery' && (
            <div className="space-y-1 pt-2">
              <label htmlFor="mobile-delivery-address" className="text-xs font-semibold text-[hsl(var(--foreground))] block">
                Delivery address <b className="text-rose-500 font-bold ml-0.5">*</b>
              </label>
              <textarea
                id="mobile-delivery-address"
                data-testid="input-buyer-address"
                value={form.address || ''}
                onChange={(e) => changeField('address', e.target.value)}
                placeholder="Street, area, landmark, or directions..."
                rows={2}
                className="w-full rounded-[10px] border border-[hsl(var(--border))] bg-neutral-50 dark:bg-neutral-800/50 p-2.5 text-[16px] sm:text-xs leading-normal resize-none focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
              />
            </div>
          )}

          {/* Order Details (if enabled) */}
          {order.checkoutAskForDetails && (
            <div className="space-y-1 pt-1">
              <label htmlFor="mobile-order-details" className="text-xs font-medium text-[hsl(var(--muted-foreground))] block">
                Delivery timing / notes (optional)
              </label>
              <textarea
                id="mobile-order-details"
                value={form.orderDetails || ''}
                onChange={(e) => changeField('orderDetails', e.target.value)}
                placeholder="Preferred delivery time or notes..."
                rows={2}
                className="w-full rounded-[10px] border border-[hsl(var(--border))] bg-neutral-50 dark:bg-neutral-800/50 p-2.5 text-[16px] sm:text-xs leading-normal resize-none focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
              />
            </div>
          )}
        </div>
      </section>

      {/* 5. PAYMENT OPTIONS (only if more than 1 mode enabled) */}
      {allowedModes.size > 1 && (
        <section className="rounded-[16px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-4 shadow-xs space-y-3" data-testid="mobile-payment-options">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            Payment options
          </h2>

          <div className="space-y-2">
            {/* Full Payment */}
            <label
              className={`flex items-start gap-3 p-3 rounded-[12px] border cursor-pointer transition min-h-[44px] ${
                chosenMode === 'full'
                  ? 'border-[hsl(var(--primary))] bg-blue-50/20 dark:bg-blue-950/20 ring-1 ring-[hsl(var(--primary))]'
                  : 'border-[hsl(var(--border))] bg-white dark:bg-neutral-900'
              }`}
            >
              <input
                type="radio"
                name="mobile-chosen-mode"
                value="full"
                checked={chosenMode === 'full'}
                onChange={() => onChosenModeChange('full')}
                className="mt-1 h-4 w-4 text-[hsl(var(--primary))]"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[hsl(var(--foreground))]">Pay in full</span>
                  <span className="text-xs font-extrabold font-mono-ui text-[hsl(var(--foreground))]">
                    {moneyExact(buyerTotal)}
                  </span>
                </div>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                  Complete payment today · No remaining balance
                </p>
              </div>
            </label>

            {/* Half Payment */}
            {allowedModes.has('half') && (
              <label
                className={`flex items-start gap-3 p-3 rounded-[12px] border cursor-pointer transition min-h-[44px] ${
                  chosenMode === 'half'
                    ? 'border-[hsl(var(--primary))] bg-blue-50/20 dark:bg-blue-950/20 ring-1 ring-[hsl(var(--primary))]'
                    : 'border-[hsl(var(--border))] bg-white dark:bg-neutral-900'
                }`}
              >
                <input
                  type="radio"
                  name="mobile-chosen-mode"
                  value="half"
                  checked={chosenMode === 'half'}
                  onChange={() => onChosenModeChange('half')}
                  className="mt-1 h-4 w-4 text-[hsl(var(--primary))]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[hsl(var(--foreground))]">
                      Pay {effectivePercent}% now
                    </span>
                    <span className="text-xs font-extrabold font-mono-ui text-[hsl(var(--foreground))]">
                      {moneyExact(halfCalc.dueNowAmount)}
                    </span>
                  </div>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                    Deposit due today · Balance of {moneyExact(halfCalc.balanceAmount)} upon delivery
                  </p>
                </div>
              </label>
            )}

            {/* Reservation */}
            {allowedModes.has('reservation') && (
              <label
                className={`flex items-start gap-3 p-3 rounded-[12px] border cursor-pointer transition min-h-[44px] ${
                  chosenMode === 'reservation'
                    ? 'border-[hsl(var(--primary))] bg-blue-50/20 dark:bg-blue-950/20 ring-1 ring-[hsl(var(--primary))]'
                    : 'border-[hsl(var(--border))] bg-white dark:bg-neutral-900'
                }`}
              >
                <input
                  type="radio"
                  name="mobile-chosen-mode"
                  value="reservation"
                  checked={chosenMode === 'reservation'}
                  onChange={() => onChosenModeChange('reservation')}
                  className="mt-1 h-4 w-4 text-[hsl(var(--primary))]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[hsl(var(--foreground))]">Reserve</span>
                    <span className="text-xs font-extrabold font-mono-ui text-[hsl(var(--foreground))]">
                      GH₵ 0.00 now
                    </span>
                  </div>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                    Full amount of {moneyExact(buyerTotal)} payable upon delivery / collection
                  </p>
                </div>
              </label>
            )}
          </div>
        </section>
      )}

      {/* 6. ORDER SUMMARY */}
      <section className="rounded-[16px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-4 shadow-xs space-y-2 text-xs">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))] pb-1 border-b border-[hsl(var(--border))]">
          Order summary
        </h2>

        <div className="flex justify-between text-[hsl(var(--muted-foreground))]">
          <span>Items subtotal</span>
          <span className="font-mono-ui font-semibold text-[hsl(var(--foreground))]">
            {moneyExact(orderSubtotal)}
          </span>
        </div>

        {selectedDeliveryMethod === 'delivery' && (
          <div className="flex justify-between text-[hsl(var(--muted-foreground))]">
            <span>Delivery fee</span>
            <span className="font-mono-ui font-semibold text-[hsl(var(--foreground))]">
              {buyerDeliveryFee > 0 ? moneyExact(buyerDeliveryFee) : 'Free'}
            </span>
          </div>
        )}

        <div className="flex justify-between pt-1 border-t border-[hsl(var(--border))] font-bold text-sm text-[hsl(var(--foreground))]">
          <span>Total</span>
          <span className="font-mono-ui text-base font-extrabold">
            {moneyExact(buyerTotal)}
          </span>
        </div>

        {chosenMode === 'half' && (
          <div className="pt-2 border-t border-dashed border-[hsl(var(--border))] space-y-1">
            <div className="flex justify-between font-bold text-blue-600 dark:text-blue-400 text-xs">
              <span>Deposit due today</span>
              <span className="font-mono-ui">{moneyExact(dueNow)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-[hsl(var(--muted-foreground))]">
              <span>Remaining balance on delivery</span>
              <span className="font-mono-ui">{moneyExact(balanceRemaining)}</span>
            </div>
          </div>
        )}

        {chosenMode === 'reservation' && (
          <div className="pt-2 border-t border-dashed border-[hsl(var(--border))] space-y-1">
            <div className="flex justify-between font-bold text-amber-600 dark:text-amber-400 text-xs">
              <span>Due today</span>
              <span className="font-mono-ui">GH₵ 0.00</span>
            </div>
            <div className="flex justify-between text-[11px] text-[hsl(var(--muted-foreground))]">
              <span>Pay on delivery / collection</span>
              <span className="font-mono-ui">{moneyExact(buyerTotal)}</span>
            </div>
          </div>
        )}
      </section>

      {/* Validation error message */}
      {submitError && (
        <div
          className="rounded-[10px] border border-rose-200 bg-rose-50 dark:bg-rose-950/20 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2"
          role="alert"
          data-testid="status-public-order-error"
        >
          <AlertCircle size={15} className="text-rose-500 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* 7. PAY BUTTON (last: full width, 52px tall, 12px radius) */}
      <div className="pt-2 pb-6 space-y-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitPending || !isFormValidToPay}
          className="w-full h-[52px] rounded-[12px] bg-[hsl(var(--primary))] hover:opacity-95 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
          data-testid="button-submit-public-order"
        >
          {submitPending && <Loader2 className="animate-spin" size={16} />}
          <span>
            {chosenMode === 'reservation'
              ? 'Confirm reservation · Pay on delivery'
              : chosenMode === 'half'
                ? `Pay ${moneyExact(dueNow)} deposit`
                : `Pay ${moneyExact(dueNow)}`}
          </span>
          <ArrowRight size={16} />
        </button>

        <div className="flex items-center justify-center gap-1.5 text-center text-[11px] text-[hsl(var(--muted-foreground))]">
          <ShieldCheck size={13} className="text-emerald-500 shrink-0" />
          <span>Direct payment to seller · 256-bit encrypted</span>
        </div>
      </div>

      {/* Full-screen lightbox viewer */}
      <BuyerImageViewer
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        images={viewerImages}
        initialIndex={viewerIndex}
        productName={viewerTitle}
      />
    </div>
  );
}
