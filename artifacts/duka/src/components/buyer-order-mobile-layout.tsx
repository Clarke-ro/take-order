import React, { useState, useRef, useMemo, useEffect } from 'react';
import type { PublicOrder, PublicOrderItem } from '@workspace/api-client-react';
import {
  Lock,
  Check,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Truck,
  ArrowRight,
  ArrowLeft,
  ImagePlus,
  Loader2,
  ShieldCheck,
  Smartphone,
  CreditCard,
  Building2,
  Info,
  UserRound,
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

export type MobileCheckoutStep = 'details' | 'mode_selection' | 'pay_summary' | 'payment';

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
  onSubmit: (e?: React.FormEvent) => void;
  onProceedToPayment?: (e?: React.FormEvent) => void;
  itemStep?: number;
  setItemStep?: (index: number) => void;
  handleNextItem?: () => void;
  handlePrevItem?: () => void;
  validate?: () => string | null;
  setSubmitError?: (err: string) => void;
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
  submitError: externalSubmitError,
  submitPending,
  onSubmit,
  onProceedToPayment,
  itemStep: externalItemStep,
  setItemStep: externalSetItemStep,
  handleNextItem: externalHandleNextItem,
  handlePrevItem: externalHandlePrevItem,
  validate,
  setSubmitError: externalSetSubmitError,
}: BuyerOrderMobileLayoutProps) {
  // Navigation / Step state in the mobile flow:
  // 'details' -> ('mode_selection' or 'pay_summary') -> 'payment'
  const [currentStep, setCurrentStep] = useState<MobileCheckoutStep>('details');
  const [localError, setLocalError] = useState('');
  const submitError = externalSubmitError || localError;

  const setErrorMessage = (msg: string) => {
    setLocalError(msg);
    externalSetSubmitError?.(msg);
  };

  // Active item index for multiple items (synced with external if provided)
  const [internalActiveItemIndex, setInternalActiveItemIndex] = useState(0);
  const activeItemIndex = externalItemStep ?? internalActiveItemIndex;

  const setActiveItem = (index: number) => {
    setErrorMessage('');
    if (externalSetItemStep) {
      externalSetItemStep(index);
    } else {
      setInternalActiveItemIndex(index);
    }
  };

  const totalItemCount = order.items?.length || 1;
  const currentItem: PublicOrderItem | undefined = order.items?.[activeItemIndex] || order.items?.[0];
  const currentItemForm = itemForms[activeItemIndex];

  // Lightbox state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerTitle, setViewerTitle] = useState('');

  // Gallery active index for current item
  const [activeMainImageIndex, setActiveMainImageIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const touchStartX = useRef<number | null>(null);

  // Reset gallery image when navigating across items
  useEffect(() => {
    setActiveMainImageIndex(0);
  }, [activeItemIndex]);

  const currentItemImages: string[] = useMemo(() => {
    if (!currentItem) return [];
    if (currentItem.imageUrls && currentItem.imageUrls.length > 0) return currentItem.imageUrls;
    if ((currentItem as any).imageUrl) return [(currentItem as any).imageUrl];
    return [];
  }, [currentItem]);

  const activeMainImage = currentItemImages[activeMainImageIndex] || currentItemImages[0] || '';

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
    if (touchStartX.current == null || currentItemImages.length < 2) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(deltaX) > 35) {
      if (deltaX < 0) {
        handleSelectThumbnail((activeMainImageIndex + 1) % currentItemImages.length);
      } else {
        handleSelectThumbnail((activeMainImageIndex - 1 + currentItemImages.length) % currentItemImages.length);
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

  // Phone prefix default based on currency
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

  // Payment Provider state in the final Payment Screen
  const [paymentProvider, setPaymentProvider] = useState<'momo' | 'card'>('momo');
  const [momoNetwork, setMomoNetwork] = useState<'mtn' | 'telecel' | 'at'>('mtn');
  const [momoPhone, setMomoPhone] = useState(form.phone || '');
  const [cardData, setCardData] = useState({
    number: '',
    expiry: '',
    cvc: '',
    name: form.name || '',
  });
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [processingStatusText, setProcessingStatusText] = useState('Processing payment...');

  // Keep phone & name in sync with form
  useEffect(() => {
    if (form.phone && !momoPhone) setMomoPhone(form.phone);
  }, [form.phone]);

  useEffect(() => {
    if (form.name && !cardData.name) setCardData((c) => ({ ...c, name: form.name }));
  }, [form.name]);

  // Validate the order details & contact information before advancing past Step 1
  const validateDetailsStep = (): string | null => {
    if (validate) {
      return validate();
    }
    // Fallback validation if not provided
    if (order.items) {
      for (let i = 0; i < order.items.length; i++) {
        const itm = order.items[i];
        const f = itemForms[i];
        if (itm.preferences && itm.preferences.length > 0) {
          for (const pref of itm.preferences) {
            if (!f?.preferences?.[pref.label]) {
              setActiveItem(i);
              return `Please choose an option for ${pref.label}`;
            }
          }
        }
        if (order.checkoutAllowReferenceImages !== false && itm.source === 'custom' && !f?.imagePreview) {
          setActiveItem(i);
          return `Please attach a reference photo for ${itm.productName}`;
        }
      }
    }
    const isSaved = Boolean(order.savedCustomer && !isEditingCustomer);
    if (!isSaved) {
      if (!form.name?.trim()) return 'Please enter your name';
      if (!form.phone?.trim() || form.phone.trim().length < 5) return 'Please enter your phone number';
    }
    if (!selectedDeliveryMethod) return 'Please choose a delivery service';
    if (selectedDeliveryMethod === 'delivery' && !form.address?.trim()) return 'Please enter your delivery address';
    return null;
  };

  // Navigation handlers between multiple items in the same row
  const handleItemPrev = () => {
    setErrorMessage('');
    if (externalHandlePrevItem) {
      externalHandlePrevItem();
    } else {
      setActiveItem(Math.max(0, activeItemIndex - 1));
    }
  };

  const handleItemNext = () => {
    setErrorMessage('');
    // Verify current item options before moving to the next item
    if (currentItem?.preferences && currentItem.preferences.length > 0) {
      const missingPref = currentItem.preferences.find((p) => !currentItemForm?.preferences?.[p.label]);
      if (missingPref) {
        setErrorMessage(`Please choose an option for ${missingPref.label}`);
        return;
      }
    }
    if (order.checkoutAllowReferenceImages !== false && currentItem?.source === 'custom' && !currentItemForm?.imagePreview) {
      setErrorMessage(`Please attach a reference photo for ${currentItem.productName}`);
      return;
    }
    if (externalHandleNextItem) {
      externalHandleNextItem();
    } else {
      setActiveItem(Math.min(totalItemCount - 1, activeItemIndex + 1));
    }
  };

  // Step 1: Click "Checkout"
  const handleCheckoutClick = () => {
    setErrorMessage('');
    const error = validateDetailsStep();
    if (error) {
      setErrorMessage(error);
      return;
    }
    // If delivery fee is 0 and no method chosen, default to pickup
    if (!form.deliveryMethod && order.deliveryFee === 0) {
      changeField('deliveryMethod', 'pickup');
    }
    // Advance to next screen:
    // If multiple payment options are available -> selection of payment modes
    // If no payment options (<= 1 mode) -> directly to pay button page
    if (allowedModes.size > 1) {
      setCurrentStep('mode_selection');
    } else {
      setCurrentStep('pay_summary');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 2: Click Pay from Mode Selection or Pay Summary
  const handleProceedToPaymentScreen = () => {
    setErrorMessage('');
    // If reservation is chosen, no payment is due now -> submit directly to order received
    if (chosenMode === 'reservation') {
      onSubmit();
      return;
    }
    // For payments with amounts due (full or half), navigate to the Payment Screen
    setCurrentStep('payment');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 3: Authorize / Complete Payment in Payment Screen
  const handleAuthorizePayment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage('');

    if (paymentProvider === 'momo') {
      if (!momoPhone.trim() || momoPhone.trim().length < 5) {
        setErrorMessage('Please enter your Mobile Money phone number');
        return;
      }
    } else if (paymentProvider === 'card') {
      const cleanNum = cardData.number.replace(/\s+/g, '');
      if (cleanNum.length < 12) {
        setErrorMessage('Please enter a valid card number');
        return;
      }
      if (!cardData.expiry.trim() || cardData.expiry.length < 4) {
        setErrorMessage('Please enter the card expiry date (MM/YY)');
        return;
      }
      if (!cardData.cvc.trim() || cardData.cvc.length < 3) {
        setErrorMessage('Please enter the 3 or 4 digit security code (CVC)');
        return;
      }
    }

    // Authentic simulated payment processing sequence before finalizing the order
    setIsProcessingPayment(true);
    setProcessingStatusText(
      paymentProvider === 'momo'
        ? `Sending prompt to ${momoPhone}...`
        : 'Authorizing card payment...'
    );

    setTimeout(() => {
      setProcessingStatusText('Payment authorized · Finalizing order...');
      setTimeout(() => {
        setIsProcessingPayment(false);
        // Call order submission API to save order and proceed to Order received page
        onSubmit(e);
      }, 700);
    }, 900);
  };

  return (
    <div
      data-testid="buyer-mobile-layout"
      className="w-full max-w-[430px] mx-auto px-4 py-4 space-y-4 font-sans text-[hsl(var(--foreground))] select-text"
    >
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

      {/* Global error banner */}
      {submitError && (
        <div
          className="rounded-[10px] border border-rose-200 bg-rose-50 dark:bg-rose-950/20 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2 page-in"
          role="alert"
          data-testid="status-public-order-error"
        >
          <AlertCircle size={15} className="text-rose-500 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 1: ORDER DETAILS & CUSTOMIZATION (Items & Buyer Contact)           */}
      {/* ========================================================================= */}
      {currentStep === 'details' && (
        <div className="space-y-4 page-in">
          {/* 2. PRODUCT SECTION (white card, 16px radius) */}
          <section className="rounded-[16px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-4 shadow-xs space-y-4">
            {/* MULTI-ITEM NAVIGATION: In the same row with Next and Previous buttons */}
            {totalItemCount > 1 && (
              <div className="p-2.5 rounded-[12px] bg-neutral-50 dark:bg-neutral-800/60 border border-[hsl(var(--border))] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={activeItemIndex === 0}
                    onClick={handleItemPrev}
                    data-testid="button-prev-mobile-item"
                    className="inline-flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-semibold bg-white dark:bg-neutral-900 border border-[hsl(var(--border))] text-[hsl(var(--foreground))] disabled:opacity-35 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer shadow-2xs"
                    aria-label="Previous item"
                  >
                    <ChevronLeft size={15} />
                    <span>Previous</span>
                  </button>

                  <div className="flex flex-col items-center text-center min-w-0 px-1">
                    <span className="text-xs font-bold text-[hsl(var(--foreground))]">
                      Item {activeItemIndex + 1} of {totalItemCount}
                    </span>
                    <span className="text-[11px] text-[hsl(var(--muted-foreground))] truncate max-w-[130px]">
                      {currentItem?.productName}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={activeItemIndex === totalItemCount - 1}
                    onClick={handleItemNext}
                    data-testid="button-next-mobile-item"
                    className="inline-flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-semibold bg-white dark:bg-neutral-900 border border-[hsl(var(--border))] text-[hsl(var(--foreground))] disabled:opacity-35 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer shadow-2xs"
                    aria-label="Next item"
                  >
                    <span>Next</span>
                    <ChevronRight size={15} />
                  </button>
                </div>

                {/* Thumbnail pills strip placed in the same row */}
                <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
                  {order.items.map((item, idx) => {
                    const isSelected = idx === activeItemIndex;
                    const itemThumb = item.imageUrls?.[0] || (item as any).imageUrl;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveItem(idx)}
                        data-testid={`mobile-item-nav-${idx}`}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0 border transition cursor-pointer',
                          isSelected
                            ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 font-bold'
                            : 'border-[hsl(var(--border))] bg-white dark:bg-neutral-900 text-[hsl(var(--muted-foreground))] hover:bg-neutral-100'
                        )}
                      >
                        {itemThumb && (
                          <img src={itemThumb} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
                        )}
                        <span className="truncate max-w-[80px]">Item {idx + 1}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Gallery for current item */}
            {currentItemImages.length > 0 && (
              <div className="space-y-2">
                <div
                  className="relative aspect-square w-full overflow-hidden rounded-[12px] bg-neutral-100 dark:bg-neutral-800 cursor-pointer"
                  onTouchStart={handleSwipeStart}
                  onTouchEnd={handleSwipeEnd}
                  onClick={() =>
                    openLightbox(currentItemImages, activeMainImageIndex, currentItem?.productName || 'Product')
                  }
                  data-testid="mobile-main-image-trigger"
                >
                  <img
                    src={activeMainImage}
                    alt={`${currentItem?.productName || 'Product'} view ${activeMainImageIndex + 1}`}
                    className={`h-full w-full object-cover transition-opacity duration-150 ${
                      isFading ? 'opacity-0' : 'opacity-100'
                    }`}
                  />

                  {/* Page dots indicator */}
                  {currentItemImages.length > 1 && (
                    <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/50 backdrop-blur-xs">
                      {currentItemImages.map((_, i) => (
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
                {currentItemImages.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto py-1">
                    {currentItemImages.map((thumb, idx) => (
                      <button
                        key={`${thumb}-${idx}`}
                        type="button"
                        data-testid={`mobile-thumb-${idx}`}
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

            {/* Current item title & price */}
            {currentItem && (
              <div className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-base font-bold text-[hsl(var(--foreground))] leading-snug">
                    {currentItem.productName}
                  </h2>
                  <div className="text-base font-extrabold text-[hsl(var(--foreground))] font-mono-ui shrink-0">
                    {moneyExact(currentItem.amount)}
                  </div>
                </div>
                {currentItem.description && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 leading-relaxed">
                    {currentItem.description}
                  </p>
                )}
                {currentItem.stock != null && (
                  <div className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
                    {currentItem.available === false ? (
                      <span className="text-rose-500 font-semibold">Out of stock</span>
                    ) : (
                      <span>{currentItem.stock} in stock</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* OPTIONS AND PREFERENCES FOR CURRENT ITEM */}
            {currentItem && (
              <div className="space-y-4 pt-2 border-t border-[hsl(var(--border))]">
                {/* Variants / Preferences */}
                {currentItem.preferences && currentItem.preferences.length > 0 && (
                  <div className="space-y-2.5">
                    {currentItem.preferences.map((pref) => {
                      const selectedVal = currentItemForm?.preferences?.[pref.label];
                      const isMissing = Boolean(
                        submitError &&
                          submitError.toLowerCase().includes(pref.label.toLowerCase()) &&
                          !selectedVal
                      );

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
                                  onClick={() => changeItemPreference(activeItemIndex, pref.label, opt)}
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
                      disabled={(currentItemForm?.quantity || 1) <= 1}
                      onClick={() =>
                        changeItemQuantity(activeItemIndex, Math.max(1, (currentItemForm?.quantity || 1) - 1))
                      }
                      aria-label="Decrease quantity"
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-neutral-100 dark:bg-neutral-800 text-sm font-bold disabled:opacity-40 cursor-pointer"
                    >
                      −
                    </button>
                    <span className="min-w-6 text-center text-sm font-bold font-mono-ui">
                      {currentItemForm?.quantity || 1}
                    </span>
                    <button
                      type="button"
                      disabled={
                        currentItem.source === 'catalog' &&
                        (currentItemForm?.quantity || 1) >= (currentItem.stock ?? 999)
                      }
                      onClick={() =>
                        changeItemQuantity(activeItemIndex, (currentItemForm?.quantity || 1) + 1)
                      }
                      aria-label="Increase quantity"
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-neutral-100 dark:bg-neutral-800 text-sm font-bold disabled:opacity-40 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Custom reference image upload */}
                {currentItem.source === 'custom' && order.checkoutAllowReferenceImages !== false && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-xs font-semibold text-[hsl(var(--foreground))]">
                      Reference image <b className="text-rose-500 font-bold ml-0.5">*</b>
                    </span>
                    <label className="flex items-center justify-center gap-2 p-3 rounded-[10px] border border-dashed border-[hsl(var(--border))] bg-neutral-50 dark:bg-neutral-800/40 text-xs text-[hsl(var(--muted-foreground))] cursor-pointer min-h-[44px]">
                      <ImagePlus size={16} />
                      <span>{currentItemForm?.image ? 'Change photo' : 'Upload photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) changeItemImage(activeItemIndex, file);
                        }}
                      />
                    </label>
                    {currentItemForm?.imagePreview && (
                      <img
                        src={currentItemForm.imagePreview}
                        alt="Reference preview"
                        className="h-20 w-20 rounded-lg object-cover border border-[hsl(var(--border))]"
                      />
                    )}
                  </div>
                )}

                {/* Item note */}
                <div className="space-y-1">
                  <label
                    htmlFor={`mobile-item-note-${activeItemIndex}`}
                    className="text-xs font-medium text-[hsl(var(--muted-foreground))]"
                  >
                    Note for seller (optional)
                  </label>
                  <textarea
                    id={`mobile-item-note-${activeItemIndex}`}
                    value={currentItemForm?.details || ''}
                    onChange={(e) => changeItemDetails(activeItemIndex, e.target.value)}
                    placeholder="Specific request for this item..."
                    rows={2}
                    className="w-full rounded-[10px] border border-[hsl(var(--border))] bg-neutral-50 dark:bg-neutral-800/50 p-2.5 text-[16px] sm:text-xs leading-normal resize-none focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                  />
                </div>
              </div>
            )}
          </section>

          {/* 3. YOUR DETAILS (buyer contact card) */}
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
              <div
                data-testid="prefilled-customer-card"
                className="rounded-[10px] border border-[hsl(var(--border))] bg-neutral-50 dark:bg-neutral-800/40 p-3 space-y-1"
              >
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
                  <label
                    htmlFor="mobile-buyer-name"
                    className="text-xs font-semibold text-[hsl(var(--foreground))] block mb-1"
                  >
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
                  <label
                    htmlFor="mobile-buyer-phone"
                    className="text-xs font-semibold text-[hsl(var(--foreground))] block mb-1"
                  >
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
                  data-testid="delivery-method-pickup"
                  onClick={() => changeField('deliveryMethod', 'pickup')}
                  className={`p-3 rounded-[10px] border text-left transition cursor-pointer min-h-[44px] ${
                    selectedDeliveryMethod === 'pickup'
                      ? 'border-[hsl(var(--primary))] bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                      : 'border-[hsl(var(--border))] bg-neutral-50 dark:bg-neutral-800/50 text-[hsl(var(--foreground))]'
                  }`}
                >
                  <div className="text-xs font-bold">Pick up</div>
                  <div
                    className={`text-[11px] ${
                      selectedDeliveryMethod === 'pickup' ? 'opacity-90' : 'text-[hsl(var(--muted-foreground))]'
                    }`}
                  >
                    Free
                  </div>
                </button>

                <button
                  type="button"
                  data-testid="delivery-method-delivery"
                  onClick={() => changeField('deliveryMethod', 'delivery')}
                  className={`p-3 rounded-[10px] border text-left transition cursor-pointer min-h-[44px] ${
                    selectedDeliveryMethod === 'delivery'
                      ? 'border-[hsl(var(--primary))] bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                      : 'border-[hsl(var(--border))] bg-neutral-50 dark:bg-neutral-800/50 text-[hsl(var(--foreground))]'
                  }`}
                >
                  <div className="text-xs font-bold">Delivery</div>
                  <div
                    className={`text-[11px] ${
                      selectedDeliveryMethod === 'delivery' ? 'opacity-90' : 'text-[hsl(var(--muted-foreground))]'
                    }`}
                  >
                    {order.deliveryFee > 0 ? moneyExact(order.deliveryFee) : 'Free'}
                  </div>
                </button>
              </div>

              {/* Delivery Address Field */}
              {selectedDeliveryMethod === 'delivery' && (
                <div className="space-y-1 pt-2">
                  <label
                    htmlFor="mobile-delivery-address"
                    className="text-xs font-semibold text-[hsl(var(--foreground))] block"
                  >
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
                  <label
                    htmlFor="mobile-order-details"
                    className="text-xs font-medium text-[hsl(var(--muted-foreground))] block"
                  >
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

          {/* 4. ORDER SUMMARY */}
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
          </section>

          {/* 5. CHECKOUT BUTTON (bottom of Step 1) */}
          <div className="pt-2 pb-6 space-y-3">
            <button
              type="button"
              onClick={handleCheckoutClick}
              disabled={submitPending}
              className="w-full h-[52px] rounded-[12px] bg-[hsl(var(--primary))] hover:opacity-95 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              data-testid="button-mobile-checkout"
            >
              <span>Checkout · {moneyExact(buyerTotal)}</span>
              <ArrowRight size={16} />
            </button>

            <div className="flex items-center justify-center gap-1.5 text-center text-[11px] text-[hsl(var(--muted-foreground))]">
              <ShieldCheck size={13} className="text-emerald-500 shrink-0" />
              <span>Direct checkout with seller · Safe & encrypted</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 2A: PAYMENT MODE SELECTION (When seller enabled multiple modes)    */}
      {/* ========================================================================= */}
      {currentStep === 'mode_selection' && (
        <div className="space-y-4 page-in">
          {/* Back button */}
          <button
            type="button"
            onClick={() => {
              setErrorMessage('');
              setCurrentStep('details');
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition cursor-pointer"
            data-testid="button-back-to-details"
          >
            <ArrowLeft size={14} />
            <span>Back to order details</span>
          </button>

          {/* Mode cards card */}
          <section
            className="rounded-[16px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-4 shadow-xs space-y-3"
            data-testid="mobile-payment-options"
          >
            <div>
              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">Step 2 of 3</span>
              <h2 className="text-base font-bold text-[hsl(var(--foreground))]">
                Choose payment option
              </h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                Select your preferred way to settle this order
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              {/* Full Payment */}
              <label
                data-testid="payment-mode-full"
                className={`flex items-start gap-3 p-3.5 rounded-[12px] border cursor-pointer transition min-h-[44px] ${
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
                  data-testid="payment-mode-half"
                  className={`flex items-start gap-3 p-3.5 rounded-[12px] border cursor-pointer transition min-h-[44px] ${
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
                  data-testid="payment-mode-reservation"
                  className={`flex items-start gap-3 p-3.5 rounded-[12px] border cursor-pointer transition min-h-[44px] ${
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

          {/* Summary Breakdown for chosen mode */}
          <section className="rounded-[16px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-4 shadow-xs space-y-2 text-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))] pb-1 border-b border-[hsl(var(--border))]">
              Payment breakdown
            </h3>

            <div className="flex justify-between text-[hsl(var(--muted-foreground))]">
              <span>Order total</span>
              <span className="font-mono-ui font-semibold text-[hsl(var(--foreground))]">
                {moneyExact(buyerTotal)}
              </span>
            </div>

            <div className="flex justify-between pt-1 border-t border-[hsl(var(--border))] font-bold text-sm text-[hsl(var(--foreground))]">
              <span>Amount due today</span>
              <span className="font-mono-ui text-base font-extrabold">
                {moneyExact(dueNow)}
              </span>
            </div>

            {balanceRemaining > 0 && (
              <div className="flex justify-between text-[11px] text-[hsl(var(--muted-foreground))] pt-1 border-t border-dashed border-[hsl(var(--border))]">
                <span>Remaining balance</span>
                <span className="font-mono-ui font-medium">{moneyExact(balanceRemaining)}</span>
              </div>
            )}
          </section>

          {/* Primary Pay Button on Mode Selection Screen */}
          <div className="pt-2 pb-6 space-y-3">
            <button
              type="button"
              onClick={handleProceedToPaymentScreen}
              disabled={submitPending}
              className="w-full h-[52px] rounded-[12px] bg-[hsl(var(--primary))] hover:opacity-95 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              data-testid={chosenMode === 'reservation' ? 'button-confirm-reservation' : 'button-proceed-to-payment'}
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
              <span>Next: authorize your payment with seller</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 2B: PAY BUTTON PAGE (When no payment modes to choose from)          */}
      {/* ========================================================================= */}
      {currentStep === 'pay_summary' && (
        <div className="space-y-4 page-in">
          {/* Back button */}
          <button
            type="button"
            onClick={() => {
              setErrorMessage('');
              setCurrentStep('details');
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition cursor-pointer"
            data-testid="button-back-to-details"
          >
            <ArrowLeft size={14} />
            <span>Back to order details</span>
          </button>

          {/* Order Review Card */}
          <section className="rounded-[16px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-4 shadow-xs space-y-3.5">
            <div>
              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">Step 2 of 2</span>
              <h2 className="text-base font-bold text-[hsl(var(--foreground))]">
                Order review
              </h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                Review your items and proceed to secure payment
              </p>
            </div>

            {/* Contact recap */}
            <div className="rounded-[10px] bg-neutral-50 dark:bg-neutral-800/40 p-3 border border-[hsl(var(--border))] space-y-1 text-xs">
              <div className="flex items-center gap-2 font-medium text-[hsl(var(--foreground))]">
                <UserRound size={13} className="text-[hsl(var(--muted-foreground))] shrink-0" />
                <span className="truncate">{form.name || order.savedCustomer?.name}</span>
                <span className="text-neutral-300">·</span>
                <span className="font-mono text-[hsl(var(--muted-foreground))]">
                  {form.phone || (order.savedCustomer?.phone ? maskPhone(order.savedCustomer.phone) : '')}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                <Truck size={13} className="shrink-0" />
                <span className="truncate">
                  {selectedDeliveryMethod === 'delivery'
                    ? `Delivery to: ${form.address}`
                    : 'Store Pick up (Free)'}
                </span>
              </div>
            </div>

            {/* Items summary list */}
            <div className="pt-2 border-t border-[hsl(var(--border))] space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Items ({totalItemCount})
              </div>
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-[hsl(var(--foreground))]">
                      {itemForms[idx]?.quantity || 1}x
                    </span>
                    <span className="truncate text-[hsl(var(--foreground))]">{item.productName}</span>
                  </div>
                  <span className="font-mono-ui font-medium text-[hsl(var(--foreground))] shrink-0 ml-2">
                    {moneyExact(item.amount * (itemForms[idx]?.quantity || 1))}
                  </span>
                </div>
              ))}
            </div>

            {/* Total recap */}
            <div className="pt-3 border-t border-[hsl(var(--border))] space-y-1.5 text-xs">
              <div className="flex justify-between text-[hsl(var(--muted-foreground))]">
                <span>Subtotal</span>
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
                <span>Total amount</span>
                <span className="font-mono-ui text-base font-extrabold">
                  {moneyExact(buyerTotal)}
                </span>
              </div>
            </div>
          </section>

          {/* Primary Pay Button on Pay Summary Screen */}
          <div className="pt-2 pb-6 space-y-3">
            <button
              type="button"
              onClick={handleProceedToPaymentScreen}
              disabled={submitPending}
              className="w-full h-[52px] rounded-[12px] bg-[hsl(var(--primary))] hover:opacity-95 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              data-testid="button-proceed-to-payment"
            >
              <span>Pay {moneyExact(buyerTotal)}</span>
              <ArrowRight size={16} />
            </button>

            <div className="flex items-center justify-center gap-1.5 text-center text-[11px] text-[hsl(var(--muted-foreground))]">
              <ShieldCheck size={13} className="text-emerald-500 shrink-0" />
              <span>Direct payment to seller · 256-bit encrypted</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 3: THE PAYMENT SCREEN ("the finally the payment screen")             */}
      {/* ========================================================================= */}
      {currentStep === 'payment' && (
        <div className="space-y-4 page-in">
          {/* Back button */}
          <button
            type="button"
            disabled={isProcessingPayment}
            onClick={() => {
              setErrorMessage('');
              if (allowedModes.size > 1) {
                setCurrentStep('mode_selection');
              } else {
                setCurrentStep('pay_summary');
              }
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition cursor-pointer"
            data-testid="button-back-to-mode"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>

          {/* Main Payment Card */}
          <section className="rounded-[16px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-4 sm:p-5 shadow-xs space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Lock size={11} /> Payment screen
                </span>
                <span className="text-xs font-mono font-bold text-[hsl(var(--foreground))]">
                  {moneyExact(dueNow)} due
                </span>
              </div>
              <h2 className="text-lg font-bold text-[hsl(var(--foreground))] mt-1">
                Complete payment
              </h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                Choose your payment method to settle this order
              </p>
            </div>

            {/* Payment Method Switcher Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-[hsl(var(--border))]">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage('');
                  setPaymentProvider('momo');
                }}
                className={cn(
                  'flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition cursor-pointer',
                  paymentProvider === 'momo'
                    ? 'bg-white dark:bg-neutral-900 text-[hsl(var(--foreground))] shadow-xs'
                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                )}
                data-testid="tab-payment-momo"
              >
                <Smartphone size={15} />
                <span>Mobile Money</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setErrorMessage('');
                  setPaymentProvider('card');
                }}
                className={cn(
                  'flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition cursor-pointer',
                  paymentProvider === 'card'
                    ? 'bg-white dark:bg-neutral-900 text-[hsl(var(--foreground))] shadow-xs'
                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                )}
                data-testid="tab-payment-card"
              >
                <CreditCard size={15} />
                <span>Card</span>
              </button>
            </div>

            {/* MOBILE MONEY PROVIDER VIEW */}
            {paymentProvider === 'momo' && (
              <div className="space-y-3.5 pt-1 page-in">
                <div>
                  <span className="text-xs font-semibold text-[hsl(var(--foreground))] block mb-1.5">
                    Select network provider
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setMomoNetwork('mtn')}
                      className={cn(
                        'py-2 px-2 rounded-lg text-xs font-bold border transition text-center cursor-pointer',
                        momoNetwork === 'mtn'
                          ? 'border-amber-400 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-300 ring-1 ring-amber-400 shadow-2xs'
                          : 'border-[hsl(var(--border))] bg-neutral-50 dark:bg-neutral-800/40 text-[hsl(var(--muted-foreground))]'
                      )}
                      data-testid="button-momo-mtn"
                    >
                      MTN MoMo
                    </button>
                    <button
                      type="button"
                      onClick={() => setMomoNetwork('telecel')}
                      className={cn(
                        'py-2 px-2 rounded-lg text-xs font-bold border transition text-center cursor-pointer',
                        momoNetwork === 'telecel'
                          ? 'border-rose-400 bg-rose-50 text-rose-950 dark:bg-rose-950/40 dark:text-rose-300 ring-1 ring-rose-400 shadow-2xs'
                          : 'border-[hsl(var(--border))] bg-neutral-50 dark:bg-neutral-800/40 text-[hsl(var(--muted-foreground))]'
                      )}
                      data-testid="button-momo-telecel"
                    >
                      Telecel Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setMomoNetwork('at')}
                      className={cn(
                        'py-2 px-2 rounded-lg text-xs font-bold border transition text-center cursor-pointer',
                        momoNetwork === 'at'
                          ? 'border-blue-400 bg-blue-50 text-blue-950 dark:bg-blue-950/40 dark:text-blue-300 ring-1 ring-blue-400 shadow-2xs'
                          : 'border-[hsl(var(--border))] bg-neutral-50 dark:bg-neutral-800/40 text-[hsl(var(--muted-foreground))]'
                      )}
                      data-testid="button-momo-at"
                    >
                      AT Money
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="input-momo-phone"
                    className="text-xs font-semibold text-[hsl(var(--foreground))] block mb-1"
                  >
                    Mobile Money number
                  </label>
                  <input
                    id="input-momo-phone"
                    data-testid="input-momo-phone"
                    type="tel"
                    inputMode="tel"
                    value={momoPhone}
                    onChange={(e) => setMomoPhone(e.target.value)}
                    placeholder="024 XXX XXXX"
                    className="w-full h-11 px-3.5 rounded-[10px] border border-[hsl(var(--border))] bg-neutral-50 dark:bg-neutral-800/50 text-[16px] sm:text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                  />
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1.5 flex items-center gap-1.5">
                    <Info size={12} className="text-blue-500 shrink-0" />
                    <span>An authorization prompt will be sent to this phone.</span>
                  </p>
                </div>
              </div>
            )}

            {/* CARD PROVIDER VIEW */}
            {paymentProvider === 'card' && (
              <div className="space-y-3 pt-1 page-in">
                <div>
                  <label
                    htmlFor="input-card-number"
                    className="text-xs font-semibold text-[hsl(var(--foreground))] block mb-1"
                  >
                    Card number
                  </label>
                  <input
                    id="input-card-number"
                    data-testid="input-card-number"
                    type="text"
                    inputMode="numeric"
                    value={cardData.number}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 16);
                      const formatted = v.match(/.{1,4}/g)?.join(' ') || v;
                      setCardData((c) => ({ ...c, number: formatted }));
                    }}
                    placeholder="4000 1234 5678 9010"
                    maxLength={19}
                    className="w-full h-11 px-3.5 rounded-[10px] border border-[hsl(var(--border))] bg-neutral-50 dark:bg-neutral-800/50 text-[16px] sm:text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="input-card-expiry"
                      className="text-xs font-semibold text-[hsl(var(--foreground))] block mb-1"
                    >
                      Expiry date
                    </label>
                    <input
                      id="input-card-expiry"
                      data-testid="input-card-expiry"
                      type="text"
                      inputMode="numeric"
                      value={cardData.expiry}
                      onChange={(e) => {
                        let v = e.target.value.replace(/\D/g, '').slice(0, 4);
                        if (v.length >= 3) v = `${v.slice(0, 2)}/${v.slice(2)}`;
                        setCardData((c) => ({ ...c, expiry: v }));
                      }}
                      placeholder="MM / YY"
                      maxLength={5}
                      className="w-full h-11 px-3.5 rounded-[10px] border border-[hsl(var(--border))] bg-neutral-50 dark:bg-neutral-800/50 text-[16px] sm:text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="input-card-cvc"
                      className="text-xs font-semibold text-[hsl(var(--foreground))] block mb-1"
                    >
                      CVC
                    </label>
                    <input
                      id="input-card-cvc"
                      data-testid="input-card-cvc"
                      type="password"
                      inputMode="numeric"
                      value={cardData.cvc}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setCardData((c) => ({ ...c, cvc: v }));
                      }}
                      placeholder="123"
                      maxLength={4}
                      className="w-full h-11 px-3.5 rounded-[10px] border border-[hsl(var(--border))] bg-neutral-50 dark:bg-neutral-800/50 text-[16px] sm:text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="input-card-name"
                    className="text-xs font-semibold text-[hsl(var(--foreground))] block mb-1"
                  >
                    Name on card
                  </label>
                  <input
                    id="input-card-name"
                    data-testid="input-card-name"
                    type="text"
                    value={cardData.name}
                    onChange={(e) => setCardData((c) => ({ ...c, name: e.target.value }))}
                    placeholder="Full name on card"
                    className="w-full h-11 px-3.5 rounded-[10px] border border-[hsl(var(--border))] bg-neutral-50 dark:bg-neutral-800/50 text-[16px] sm:text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                  />
                </div>
              </div>
            )}

            {/* Summary info in payment screen */}
            <div className="pt-3 border-t border-[hsl(var(--border))] space-y-1 text-xs">
              <div className="flex justify-between font-bold text-sm text-[hsl(var(--foreground))]">
                <span>Total due today</span>
                <span className="font-mono-ui text-base font-extrabold">{moneyExact(dueNow)}</span>
              </div>
              {balanceRemaining > 0 && (
                <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
                  Remaining balance of {moneyExact(balanceRemaining)} payable on delivery.
                </div>
              )}
            </div>
          </section>

          {/* Processing Animation state */}
          {isProcessingPayment && (
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/80 dark:bg-blue-950/40 flex items-center gap-3 page-in">
              <Loader2 className="animate-spin text-blue-600 dark:text-blue-400 shrink-0" size={20} />
              <div className="min-w-0">
                <div className="text-xs font-bold text-blue-900 dark:text-blue-100">
                  {processingStatusText}
                </div>
                <div className="text-[11px] text-blue-700 dark:text-blue-300">
                  Please do not close this window.
                </div>
              </div>
            </div>
          )}

          {/* Final Authorize / Submit button */}
          <div className="pt-2 pb-6 space-y-3">
            <button
              type="button"
              onClick={handleAuthorizePayment}
              disabled={isProcessingPayment || submitPending}
              className="w-full h-[52px] rounded-[12px] bg-[hsl(var(--primary))] hover:opacity-95 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              data-testid="button-submit-public-order"
            >
              {(isProcessingPayment || submitPending) && <Loader2 className="animate-spin" size={16} />}
              <span>
                {paymentProvider === 'momo'
                  ? `Authorize ${moneyExact(dueNow)} via Mobile Money`
                  : `Pay ${moneyExact(dueNow)} with Card`}
              </span>
              <ArrowRight size={16} />
            </button>

            <div className="flex items-center justify-center gap-1.5 text-center text-[11px] text-[hsl(var(--muted-foreground))]">
              <ShieldCheck size={13} className="text-emerald-500 shrink-0" />
              <span>Direct seller payout · Encrypted 256-bit SSL</span>
            </div>
          </div>
        </div>
      )}

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
