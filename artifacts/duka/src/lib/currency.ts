export type CurrencyConfig = {
  locale: string;
  currency: string;
  symbol: string;
};

type LocationHints = {
  language?: string;
  timeZone?: string;
};

const currencyByRegion: Record<string, { currency: string; locale: string }> = {
  AE: { currency: 'AED', locale: 'en-AE' },
  AO: { currency: 'AOA', locale: 'pt-AO' },
  AU: { currency: 'AUD', locale: 'en-AU' },
  BR: { currency: 'BRL', locale: 'pt-BR' },
  CA: { currency: 'CAD', locale: 'en-CA' },
  CH: { currency: 'CHF', locale: 'de-CH' },
  CN: { currency: 'CNY', locale: 'zh-CN' },
  CV: { currency: 'CVE', locale: 'pt-CV' },
  DE: { currency: 'EUR', locale: 'de-DE' },
  EG: { currency: 'EGP', locale: 'ar-EG' },
  ES: { currency: 'EUR', locale: 'es-ES' },
  ET: { currency: 'ETB', locale: 'am-ET' },
  FR: { currency: 'EUR', locale: 'fr-FR' },
  GB: { currency: 'GBP', locale: 'en-GB' },
  GH: { currency: 'GHS', locale: 'en-GH' },
  IN: { currency: 'INR', locale: 'en-IN' },
  JP: { currency: 'JPY', locale: 'ja-JP' },
  KE: { currency: 'KES', locale: 'en-KE' },
  MZ: { currency: 'MZN', locale: 'pt-MZ' },
  NG: { currency: 'NGN', locale: 'en-NG' },
  NZ: { currency: 'NZD', locale: 'en-NZ' },
  PT: { currency: 'EUR', locale: 'pt-PT' },
  RW: { currency: 'RWF', locale: 'rw-RW' },
  ST: { currency: 'STN', locale: 'pt-ST' },
  TZ: { currency: 'TZS', locale: 'sw-TZ' },
  UG: { currency: 'UGX', locale: 'en-UG' },
  US: { currency: 'USD', locale: 'en-US' },
  ZA: { currency: 'ZAR', locale: 'en-ZA' },
  ZM: { currency: 'ZMW', locale: 'en-ZM' },
  ZW: { currency: 'ZWL', locale: 'en-ZW' },
};

const regionByTimeZone: Record<string, string> = {
  'Africa/Accra': 'GH',
  'Africa/Addis_Ababa': 'ET',
  'Africa/Cairo': 'EG',
  'Africa/Dar_es_Salaam': 'TZ',
  'Africa/Johannesburg': 'ZA',
  'Africa/Kampala': 'UG',
  'Africa/Kigali': 'RW',
  'Africa/Luanda': 'AO',
  'Africa/Maputo': 'MZ',
  'Africa/Nairobi': 'KE',
  'Africa/Lagos': 'NG',
  'Africa/Sao_Tome': 'ST',
  'America/Sao_Paulo': 'BR',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'America/New_York': 'US',
  'America/Los_Angeles': 'US',
  'Asia/Calcutta': 'IN',
  'Asia/Kolkata': 'IN',
  'Asia/Shanghai': 'CN',
  'Asia/Tokyo': 'JP',
  'Australia/Sydney': 'AU',
  'Europe/Berlin': 'DE',
  'Europe/Lisbon': 'PT',
  'Europe/London': 'GB',
  'Europe/Paris': 'FR',
  'Pacific/Auckland': 'NZ',
};

function regionFromLanguage(language: string | undefined): string | undefined {
  const match = language?.match(/[-_]([A-Z]{2}|\d{3})$/i);
  return match?.[1]?.toUpperCase();
}

function currencySymbol(locale: string, currency: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol',
    maximumFractionDigits: 0,
  }).formatToParts(0).find((part) => part.type === 'currency')?.value ?? currency;
}

export function currencyForLocation({ language, timeZone }: LocationHints = {}): CurrencyConfig {
  const region = regionFromLanguage(language) || (timeZone && regionByTimeZone[timeZone]) || 'GH';
  const selected = currencyByRegion[region] ?? currencyByRegion.GH;
  return {
    locale: selected.locale,
    currency: selected.currency,
    symbol: currencySymbol(selected.locale, selected.currency),
  };
}

const browserLocation: LocationHints = typeof navigator === 'undefined'
  ? {}
  : {
    language: navigator.language,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

export const appCurrency = currencyForLocation(browserLocation);

const exactFormatter = new Intl.NumberFormat(appCurrency.locale, {
  style: 'currency',
  currency: appCurrency.currency,
});
const compactFormatter = new Intl.NumberFormat(appCurrency.locale, {
  style: 'currency',
  currency: appCurrency.currency,
  maximumFractionDigits: 0,
});

export function formatMoney(value: number | null | undefined): string {
  return exactFormatter.format(value ?? 0);
}

export function formatCompactMoney(value: number | null | undefined): string {
  return compactFormatter.format(value ?? 0);
}