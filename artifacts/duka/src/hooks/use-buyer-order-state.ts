import { useState, useEffect, useMemo, useCallback } from 'react';
import type { PublicOrder, PublicOrderInput, PublicOrderItem } from '@workspace/api-client-react';
import { customFetch } from '@workspace/api-client-react';
import {
  calculatePaymentAmounts,
  getAllowedModesForLink,
  maskPhone,
  type PaymentModeChoice,
} from '@workspace/api-zod';

export type BuyerOrderFormValues = {
  name: string;
  phone: string;
  deliveryMethod?: 'pickup' | 'delivery';
  address?: string;
  orderDetails?: string;
  details?: string;
  image?: string;
  imagePreview?: string;
  action?: 'pay' | 'reserve';
};

export type BuyerItemFormValues = {
  preferences: Record<string, string>;
  details: string;
  image: string;
  imagePreview: string;
  quantity: number;
};

export const emptyBuyerItemForm = (): BuyerItemFormValues => ({
  preferences: {},
  details: '',
  image: '',
  imagePreview: '',
  quantity: 1,
});

export function uploadReferenceImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        const res = await customFetch<{ url: string }>('/api/upload', {
          method: 'POST',
          body: JSON.stringify({
            data: base64Data,
            filename: file.name,
          }),
        });
        resolve(res.url);
      } catch {
        resolve(file.name);
      }
    };
    reader.onerror = () => resolve(file.name);
    reader.readAsDataURL(file);
  });
}

export type UseBuyerOrderStateProps = {
  order: PublicOrder | undefined;
  token: string;
  initialChosenMode?: PaymentModeChoice;
  onSubmitSuccess?: () => void;
  onSubmitError?: (error: string) => void;
};

export function useBuyerOrderState({
  order,
  token,
  initialChosenMode,
  onSubmitSuccess,
  onSubmitError,
}: UseBuyerOrderStateProps) {
  const [chosenMode, setChosenMode] = useState<PaymentModeChoice>(() => {
    if (initialChosenMode) return initialChosenMode;
    if (order?.paymentMode === 'reserve' && !order?.allowReservation && !order?.allowHalfPayment) {
      return 'reservation';
    }
    return 'full';
  });

  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [form, setForm] = useState<BuyerOrderFormValues>({
    name: '',
    phone: '',
    deliveryMethod: undefined,
    address: '',
    orderDetails: '',
  });

  const [itemStep, setItemStep] = useState(0);
  const [itemForms, setItemForms] = useState<BuyerItemFormValues[]>([]);
  const [submitError, setSubmitError] = useState('');
  const [submitPending, setSubmitPending] = useState(false);

  // Initialize forms when order items load
  useEffect(() => {
    if (!order) return;
    setItemForms((current) => order.items.map((_, index) => current[index] ?? emptyBuyerItemForm()));
    setItemStep(0);
    setForm({ name: '', phone: '', deliveryMethod: undefined, address: '', orderDetails: '' });
  }, [order?.token, order?.items?.length]);

  const handleEditCustomer = useCallback(() => {
    setIsEditingCustomer(true);
    if (!form.name && order?.savedCustomer?.name) {
      setForm((f) => ({ ...f, name: order.savedCustomer?.name || '' }));
    }
  }, [form.name, order?.savedCustomer?.name]);

  const changeField = useCallback(
    (key: 'name' | 'phone' | 'deliveryMethod' | 'address' | 'orderDetails' | 'details', value: string) => {
      setSubmitError('');
      if (key === 'details') {
        setItemForms((current) =>
          current.map((item, index) => (index === itemStep ? { ...item, details: value } : item))
        );
        return;
      }
      setForm((current) => ({
        ...current,
        [key]: key === 'deliveryMethod' ? (value as 'pickup' | 'delivery') : value,
      }));
    },
    [itemStep]
  );

  const changeItemPreference = useCallback((targetIndex: number, label: string, option: string) => {
    setSubmitError('');
    setItemForms((current) =>
      current.map((item, index) =>
        index === targetIndex
          ? { ...item, preferences: { ...item.preferences, [label]: option } }
          : item
      )
    );
  }, []);

  const changeItemQuantity = useCallback((targetIndex: number, quantity: number) => {
    setItemForms((current) =>
      current.map((item, index) => (index === targetIndex ? { ...item, quantity } : item))
    );
  }, []);

  const changeItemDetails = useCallback((targetIndex: number, details: string) => {
    setItemForms((current) =>
      current.map((item, index) => (index === targetIndex ? { ...item, details } : item))
    );
  }, []);

  const changeItemImage = useCallback(async (targetIndex: number, file: File) => {
    setSubmitError('');
    const previewUrl = URL.createObjectURL(file);
    setItemForms((current) =>
      current.map((item, index) =>
        index === targetIndex ? { ...item, imagePreview: previewUrl, image: file.name } : item
      )
    );
    try {
      const uploadedUrl = await uploadReferenceImage(file);
      setItemForms((current) =>
        current.map((item, index) =>
          index === targetIndex ? { ...item, image: uploadedUrl } : item
        )
      );
    } catch {}
  }, []);

  // Allowed payment modes
  const allowedModes = useMemo(() => {
    if (!order) return new Set<PaymentModeChoice>(['full']);
    return getAllowedModesForLink({
      allowReservation: order.allowReservation,
      allowHalfPayment: order.allowHalfPayment,
      paymentMode: order.paymentMode,
    });
  }, [order?.allowReservation, order?.allowHalfPayment, order?.paymentMode]);

  // Order totals
  const orderSubtotal = useMemo(() => {
    if (!order?.items) return order?.amount ?? 0;
    if (itemForms.length === order.items.length) {
      return order.items.reduce(
        (sum, item, index) => sum + item.amount * (itemForms[index]?.quantity ?? item.quantity ?? 1),
        0
      );
    }
    return order.subtotal ?? order.items.reduce((sum, item) => sum + item.amount * (item.quantity ?? 1), 0);
  }, [order?.items, order?.amount, order?.subtotal, itemForms]);

  const selectedDeliveryMethod = form.deliveryMethod ?? (order?.deliveryFee === 0 ? 'pickup' : undefined);
  const buyerDeliveryFee = selectedDeliveryMethod === 'delivery' ? (order?.deliveryFee ?? 0) : 0;
  const buyerTotal = orderSubtotal + buyerDeliveryFee;

  const effectivePercent = useMemo(() => {
    const p = order?.halfPaymentPercent;
    return p != null && p >= 1 && p <= 99 ? p : 50;
  }, [order?.halfPaymentPercent]);

  const totalPesewas = Math.round(buyerTotal * 100);
  const halfCalc = useMemo(() => {
    return calculatePaymentAmounts(totalPesewas, effectivePercent);
  }, [totalPesewas, effectivePercent]);

  const dueNow = useMemo(() => {
    if (chosenMode === 'half') return halfCalc.dueNowAmount;
    if (chosenMode === 'reservation') return 0;
    return buyerTotal;
  }, [chosenMode, halfCalc.dueNowAmount, buyerTotal]);

  const balanceRemaining = useMemo(() => {
    if (chosenMode === 'half') return halfCalc.balanceAmount;
    if (chosenMode === 'reservation') return buyerTotal;
    return 0;
  }, [chosenMode, halfCalc.balanceAmount, buyerTotal]);

  // Validation function
  const validate = useCallback((): string | null => {
    if (order?.items) {
      for (let i = 0; i < order.items.length; i++) {
        const itm = order.items[i];
        const f = itemForms[i] ?? emptyBuyerItemForm();
        if (itm.preferences && itm.preferences.length > 0) {
          const missingPref = itm.preferences.find((p) => !f.preferences?.[p.label]);
          if (missingPref) {
            setItemStep(i);
            return `Please choose an option for ${missingPref.label}`;
          }
        }
        const missingImg =
          order.checkoutAllowReferenceImages !== false && itm.source === 'custom' && !f.imagePreview;
        if (missingImg) {
          setItemStep(i);
          return `Please attach a reference photo for ${itm.productName}`;
        }
      }
    }

    const isUsingSaved = Boolean(order?.savedCustomer && !isEditingCustomer);
    if (!isUsingSaved) {
      if (!form.name.trim()) {
        return 'Please enter your name';
      }
      if (!form.phone.trim() || form.phone.trim().length < 5) {
        return 'Please enter your phone number';
      }
    }

    const finalDelivery = form.deliveryMethod ?? (order?.deliveryFee === 0 ? 'pickup' : undefined);
    if (!finalDelivery) {
      return 'Please choose a delivery service';
    }
    if (finalDelivery === 'delivery' && !form.address?.trim()) {
      return 'Please enter your delivery address';
    }

    return null;
  }, [order?.items, order?.checkoutAllowReferenceImages, order?.savedCustomer, order?.deliveryFee, isEditingCustomer, form, itemForms]);

  const buildSubmitPayload = useCallback((): PublicOrderInput => {
    const isUsingSaved = Boolean(order?.savedCustomer && !isEditingCustomer);
    const paymentAction = chosenMode === 'reservation' ? 'reserve' : 'pay';
    const finalDelivery = form.deliveryMethod ?? (order?.deliveryFee === 0 ? 'pickup' : 'delivery');

    return {
      customerName: isUsingSaved ? (order?.savedCustomer?.name || '') : form.name.trim(),
      customerPhone: isUsingSaved ? undefined : form.phone.trim(),
      useSavedCustomer: isUsingSaved,
      buyerDetails: form.orderDetails?.trim() || undefined,
      deliveryMethod: finalDelivery,
      deliveryAddress: finalDelivery === 'delivery' ? form.address?.trim() || undefined : undefined,
      itemDetails: itemForms.map((item, itemIdx) => ({
        itemIndex: itemIdx,
        quantity: item.quantity,
        variant: Object.values(item.preferences).filter(Boolean).join(' · ') || undefined,
        details: item.details || undefined,
        referenceImage: item.image || undefined,
      })),
      paymentAction,
      chosenMode: (chosenMode === 'reservation' ? 'reserve' : chosenMode) as PublicOrderInput['chosenMode'],
    };
  }, [order?.savedCustomer, order?.deliveryFee, isEditingCustomer, chosenMode, form, itemForms]);

  const handleNextItem = useCallback(() => {
    if (!order) return;
    if (itemStep < order.items.length - 1) {
      const activeItem = order.items[itemStep];
      const activeForm = itemForms[itemStep] ?? emptyBuyerItemForm();
      const missingPref = activeItem?.preferences?.find((p) => !activeForm.preferences[p.label]);
      if (missingPref) {
        setSubmitError(`Please choose an option for ${missingPref.label}`);
        return;
      }
      const missingImg =
        order.checkoutAllowReferenceImages !== false && activeItem?.source === 'custom' && !activeForm.imagePreview;
      if (missingImg) {
        setSubmitError(`Please attach a reference photo for ${activeItem.productName}`);
        return;
      }
      setSubmitError('');
      setItemStep((prev) => prev + 1);
    }
  }, [order, itemStep, itemForms]);

  const handlePrevItem = useCallback(() => {
    setSubmitError('');
    setItemStep((prev) => Math.max(0, prev - 1));
  }, []);

  return {
    form,
    setForm,
    changeField,
    itemStep,
    setItemStep,
    itemForms,
    setItemForms,
    changeItemPreference,
    changeItemQuantity,
    changeItemDetails,
    changeItemImage,
    handleNextItem,
    handlePrevItem,
    isEditingCustomer,
    handleEditCustomer,
    chosenMode,
    setChosenMode,
    allowedModes,
    orderSubtotal,
    buyerDeliveryFee,
    buyerTotal,
    effectivePercent,
    halfCalc,
    dueNow,
    balanceRemaining,
    submitError,
    setSubmitError,
    submitPending,
    setSubmitPending,
    validate,
    buildSubmitPayload,
  };
}
