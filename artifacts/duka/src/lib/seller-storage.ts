export type SellerProfile = {
  sellerName: string;
  businessName: string;
  description: string;
  channels: string[];
  currency?: string;
  category?: string;
  country?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  whatsappPhone?: string;
  teamSize?: string;
  logoDataUrl?: string;
  pickupAddress?: string;
  pickupHours?: string;
  momoNetwork?: string;
  momoNumber?: string;
  momoName?: string;
  bankName?: string;
  bankAccount?: string;
  paymentInstructions?: string;
};

export type SellerSettingsPreferences = {
  orderUpdates: boolean;
  stockAlerts: boolean;
  compactTables: boolean;
};

export const defaultSellerProfile: SellerProfile = {
  sellerName: '',
  businessName: '',
  description: '',
  channels: ['whatsapp', 'instagram'],
  currency: 'GHS',
  category: '',
  country: 'Ghana',
  firstName: '',
  lastName: '',
  phone: '',
  whatsappPhone: '',
  teamSize: 'Just me',
};

export const defaultSellerPreferences: SellerSettingsPreferences = {
  orderUpdates: true,
  stockAlerts: true,
  compactTables: false,
};

const getStorage = (): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

let activeSellerUserId: string | null = null;

export const setActiveSellerUserId = (id: string | null): void => {
  activeSellerUserId = id ? id.trim() : null;
};

export const getActiveSellerUserId = (): string | null => activeSellerUserId;

export const getScopedKey = (key: string, userId?: string | null): string => {
  const cleanId = (userId || activeSellerUserId)?.trim();
  if (cleanId) {
    return `takeorder:${cleanId}:${key}`;
  }
  return `takeorder:anonymous:${key}`;
};

export const readSellerProfile = (
  userId?: string | null,
  storage: Pick<Storage, 'getItem'> | null = getStorage()
): SellerProfile => {
  if (!storage) return { ...defaultSellerProfile };
  const cleanId = (userId || activeSellerUserId)?.trim();
  let value: string | null = null;
  if (cleanId) {
    const key = getScopedKey('profile', cleanId);
    value = storage.getItem(key);
  }
  if (!value && typeof window !== 'undefined' && window.localStorage) {
    try {
      const keys = Object.keys(window.localStorage);
      const scopedKey = keys.find((k) => k.startsWith('takeorder:') && k.endsWith(':profile') && !k.includes(':anonymous:'))
        || keys.find((k) => k.startsWith('takeorder:') && k.endsWith(':profile'));
      if (scopedKey) {
        value = window.localStorage.getItem(scopedKey);
      } else {
        value = window.localStorage.getItem('duka-seller-profile');
      }
    } catch {}
  }
  if (!value) return { ...defaultSellerProfile };
  try {
    const parsed = JSON.parse(value) as Partial<SellerProfile>;
    return {
      ...defaultSellerProfile,
      ...parsed,
      channels: Array.isArray(parsed.channels) && parsed.channels.length ? parsed.channels : defaultSellerProfile.channels,
      currency: parsed.currency || defaultSellerProfile.currency,
      country: parsed.country || defaultSellerProfile.country,
      teamSize: parsed.teamSize || defaultSellerProfile.teamSize,
      phone: parsed.phone || parsed.whatsappPhone || '',
      whatsappPhone: parsed.whatsappPhone || parsed.phone || '',
    };
  } catch {
    return { ...defaultSellerProfile };
  }
};

export const writeSellerProfile = (
  profile: SellerProfile,
  userId?: string | null,
  storage: Pick<Storage, 'setItem'> | null = getStorage()
): void => {
  const cleanId = (userId || activeSellerUserId)?.trim();
  if (!cleanId || !storage) return;
  try {
    const key = getScopedKey('profile', cleanId);
    storage.setItem(key, JSON.stringify(profile));
  } catch {}
};

export const readSellerSettings = (
  userId?: string | null,
  storage: Pick<Storage, 'getItem'> | null = getStorage()
): SellerSettingsPreferences => {
  const cleanId = (userId || activeSellerUserId)?.trim();
  if (!cleanId || !storage) return defaultSellerPreferences;
  try {
    const key = getScopedKey('seller-settings', cleanId);
    const value = storage.getItem(key);
    const parsed = value ? (JSON.parse(value) as Partial<SellerSettingsPreferences>) : {};
    return {
      orderUpdates: parsed.orderUpdates !== false,
      stockAlerts: parsed.stockAlerts !== false,
      compactTables: parsed.compactTables === true,
    };
  } catch {
    return defaultSellerPreferences;
  }
};

export const writeSellerSettings = (
  settings: SellerSettingsPreferences,
  userId?: string | null,
  storage: Pick<Storage, 'setItem'> | null = getStorage()
): void => {
  const cleanId = (userId || activeSellerUserId)?.trim();
  if (!cleanId || !storage) return;
  try {
    const key = getScopedKey('seller-settings', cleanId);
    storage.setItem(key, JSON.stringify(settings));
  } catch {}
};

export const readOnboardingStep = (
  userId?: string | null,
  storage: Pick<Storage, 'getItem'> | null = getStorage()
): number => {
  const cleanId = (userId || activeSellerUserId)?.trim();
  if (!cleanId || !storage) return 0;
  try {
    const key = getScopedKey('onboarding-step', cleanId);
    const value = storage.getItem(key);
    const step = Number(value);
    return Number.isInteger(step) && step >= 0 && step <= 4 ? step : 0;
  } catch {
    return 0;
  }
};

export const writeOnboardingStep = (
  step: number,
  userId?: string | null,
  storage: Pick<Storage, 'setItem'> | null = getStorage()
): void => {
  const cleanId = (userId || activeSellerUserId)?.trim();
  if (!cleanId || !storage) return;
  try {
    const key = getScopedKey('onboarding-step', cleanId);
    storage.setItem(key, String(step));
  } catch {}
};

export const readOnboardingComplete = (
  userId?: string | null,
  storage: Pick<Storage, 'getItem'> | null = getStorage()
): boolean => {
  const cleanId = (userId || activeSellerUserId)?.trim();
  if (!cleanId || !storage) return false;
  try {
    const key = getScopedKey('onboarding-complete', cleanId);
    return storage.getItem(key) === 'true';
  } catch {
    return false;
  }
};

export const finishOnboarding = (
  userId?: string | null,
  storage: Pick<Storage, 'setItem'> | null = getStorage()
): void => {
  const cleanId = (userId || activeSellerUserId)?.trim();
  if (!cleanId || !storage) return;
  try {
    const key = getScopedKey('onboarding-complete', cleanId);
    storage.setItem(key, 'true');
  } catch {}
};

const CONNECTED_TOOLS_FALLBACK_KEY = 'duka-connected-tools';
const connectedToolNames = new Set<string>([
  'WhatsApp',
  'Instagram',
  'TikTok',
  'Facebook Ads',
  'Snapchat',
  'Paystack',
  'Mobile Money',
  'X',
]);
const normalizeConnectedTools = (tools: readonly string[]) =>
  [...new Set(tools.filter((tool) => connectedToolNames.has(tool)))];

export const readConnectedTools = (
  userIdOrStorage?: string | Pick<Storage, 'getItem'> | null,
  maybeStorage: Pick<Storage, 'getItem'> | null = getStorage()
): string[] => {
  const isStorage = userIdOrStorage && typeof userIdOrStorage === 'object' && 'getItem' in userIdOrStorage;
  const targetUserId = isStorage ? null : (userIdOrStorage as string | null);
  const storage = isStorage ? (userIdOrStorage as Pick<Storage, 'getItem'>) : maybeStorage;

  if (!storage) return [];
  const cleanId = (targetUserId || activeSellerUserId)?.trim();
  const key = cleanId ? getScopedKey('connected-tools', cleanId) : CONNECTED_TOOLS_FALLBACK_KEY;
  try {
    const value = storage.getItem(key);
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) && parsed.every((item): item is string => typeof item === 'string')
      ? normalizeConnectedTools(parsed)
      : [];
  } catch {
    return [];
  }
};

export const writeConnectedTools = (
  tools: readonly string[],
  userIdOrStorage?: string | Pick<Storage, 'setItem'> | null,
  maybeStorage: Pick<Storage, 'setItem'> | null = getStorage()
): void => {
  const isStorage = userIdOrStorage && typeof userIdOrStorage === 'object' && 'setItem' in userIdOrStorage;
  const targetUserId = isStorage ? null : (userIdOrStorage as string | null);
  const storage = isStorage ? (userIdOrStorage as Pick<Storage, 'setItem'>) : maybeStorage;

  if (!storage) return;
  const cleanId = (targetUserId || activeSellerUserId)?.trim();
  const key = cleanId ? getScopedKey('connected-tools', cleanId) : CONNECTED_TOOLS_FALLBACK_KEY;
  try {
    storage.setItem(key, JSON.stringify(normalizeConnectedTools(tools)));
  } catch {}
};

export const clearConnectedTools = (
  userIdOrStorage?: string | Pick<Storage, 'removeItem'> | null,
  maybeStorage: Pick<Storage, 'removeItem'> | null = getStorage()
): void => {
  const isStorage = userIdOrStorage && typeof userIdOrStorage === 'object' && 'removeItem' in userIdOrStorage;
  const targetUserId = isStorage ? null : (userIdOrStorage as string | null);
  const storage = isStorage ? (userIdOrStorage as Pick<Storage, 'removeItem'>) : maybeStorage;

  if (!storage) return;
  const cleanId = (targetUserId || activeSellerUserId)?.trim();
  const key = cleanId ? getScopedKey('connected-tools', cleanId) : CONNECTED_TOOLS_FALLBACK_KEY;
  try {
    storage.removeItem(key);
  } catch {}
};

export const readChecklistDismissed = (
  userId?: string | null,
  storage: Pick<Storage, 'getItem'> | null = getStorage()
): boolean => {
  const cleanId = (userId || activeSellerUserId)?.trim();
  if (!cleanId || !storage) return false;
  try {
    const key = getScopedKey('checklist-dismissed', cleanId);
    return storage.getItem(key) === 'true';
  } catch {
    return false;
  }
};

export const writeChecklistDismissed = (
  dismissedOrUserId: boolean | string | null = true,
  userIdOrStorage?: string | Pick<Storage, 'setItem'> | null,
  maybeStorage: Pick<Storage, 'setItem'> | null = getStorage()
): void => {
  let dismissed = true;
  let targetUserId: string | null = null;
  let storage: Pick<Storage, 'setItem'> | null = maybeStorage;

  if (typeof dismissedOrUserId === 'boolean') {
    dismissed = dismissedOrUserId;
    targetUserId = typeof userIdOrStorage === 'string' ? userIdOrStorage : null;
    storage = (userIdOrStorage && typeof userIdOrStorage === 'object') ? (userIdOrStorage as Pick<Storage, 'setItem'>) : maybeStorage;
  } else if (typeof dismissedOrUserId === 'string') {
    dismissed = true;
    targetUserId = dismissedOrUserId;
    storage = (userIdOrStorage && typeof userIdOrStorage === 'object') ? (userIdOrStorage as Pick<Storage, 'setItem'>) : maybeStorage;
  }

  const cleanId = (targetUserId || activeSellerUserId)?.trim();
  if (!cleanId || !storage) return;
  try {
    const key = getScopedKey('checklist-dismissed', cleanId);
    storage.setItem(key, dismissed ? 'true' : 'false');
  } catch {}
};

export const clearAllSellerStorage = (storage: Storage | null = getStorage()): void => {
  if (!storage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && (k.startsWith('takeorder:') || k.startsWith('duka-'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => storage.removeItem(k));
  } catch {}
};
