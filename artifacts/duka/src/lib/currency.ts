export type CurrencyConfig = {
  locale: string;
  currency: string;
  symbol: string;
};

export const storeCurrencyCodes = [
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM', 'BBD', 'BDT',
  'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL', 'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD',
  'CDF', 'CHF', 'CLP', 'CNY', 'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD',
  'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD', 'GNF', 'GTQ',
  'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD',
  'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR',
  'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR',
  'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN',
  'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR',
  'SDG', 'SEK', 'SGD', 'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SYP', 'SZL', 'THB', 'TJS',
  'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD', 'UYU', 'UZS', 'VES',
  'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XOF', 'XPF', 'YER', 'ZAR', 'ZMW', 'ZWL',
] as const;

type CurrencyCode = typeof storeCurrencyCodes[number];

const currencyByRegion: Record<string, CurrencyCode> = {
  AD: 'EUR', AE: 'AED', AF: 'AFN', AG: 'XCD', AI: 'XCD', AL: 'ALL', AM: 'AMD', AO: 'AOA',
  AR: 'ARS', AS: 'USD', AT: 'EUR', AU: 'AUD', AW: 'AWG', AX: 'EUR', AZ: 'AZN', BA: 'BAM',
  BB: 'BBD', BD: 'BDT', BE: 'EUR', BF: 'XOF', BG: 'BGN', BH: 'BHD', BI: 'BIF', BJ: 'XOF',
  BL: 'EUR', BM: 'BMD', BN: 'BND', BO: 'BOB', BQ: 'USD', BR: 'BRL', BS: 'BSD', BT: 'BTN',
  BV: 'NOK', BW: 'BWP', BY: 'BYN', BZ: 'BZD', CA: 'CAD', CC: 'AUD', CD: 'CDF', CF: 'XAF',
  CG: 'XAF', CH: 'CHF', CI: 'XOF', CK: 'NZD', CL: 'CLP', CM: 'XAF', CN: 'CNY', CO: 'COP',
  CR: 'CRC', CU: 'CUP', CV: 'CVE', CW: 'ANG', CX: 'AUD', CY: 'EUR', CZ: 'CZK', DE: 'EUR',
  DJ: 'DJF', DK: 'DKK', DM: 'XCD', DO: 'DOP', DZ: 'DZD', EC: 'USD', EE: 'EUR', EG: 'EGP',
  EH: 'MAD', ER: 'ERN', ES: 'EUR', ET: 'ETB', FI: 'EUR', FJ: 'FJD', FK: 'FKP', FM: 'USD',
  FO: 'DKK', FR: 'EUR', GA: 'XAF', GB: 'GBP', GD: 'XCD', GE: 'GEL', GF: 'EUR', GG: 'GBP',
  GH: 'GHS', GI: 'GIP', GL: 'DKK', GM: 'GMD', GN: 'GNF', GP: 'EUR', GQ: 'XAF', GR: 'EUR',
  GS: 'GBP', GT: 'GTQ', GU: 'USD', GW: 'XOF', GY: 'GYD', HK: 'HKD', HM: 'AUD', HN: 'HNL',
  HR: 'EUR', HT: 'HTG', HU: 'HUF', ID: 'IDR', IE: 'EUR', IL: 'ILS', IM: 'GBP', IN: 'INR',
  IO: 'USD', IQ: 'IQD', IR: 'IRR', IS: 'ISK', IT: 'EUR', JE: 'GBP', JM: 'JMD', JO: 'JOD',
  JP: 'JPY', KE: 'KES', KG: 'KGS', KH: 'KHR', KI: 'AUD', KM: 'KMF', KN: 'XCD', KP: 'KPW',
  KR: 'KRW', KW: 'KWD', KY: 'KYD', KZ: 'KZT', LA: 'LAK', LB: 'LBP', LC: 'XCD', LI: 'CHF',
  LK: 'LKR', LR: 'LRD', LS: 'LSL', LT: 'EUR', LU: 'EUR', LV: 'EUR', LY: 'LYD', MA: 'MAD',
  MC: 'EUR', MD: 'MDL', ME: 'EUR', MF: 'EUR', MG: 'MGA', MH: 'USD', MK: 'MKD', ML: 'XOF',
  MM: 'MMK', MN: 'MNT', MO: 'MOP', MP: 'USD', MQ: 'EUR', MR: 'MRU', MS: 'XCD', MT: 'EUR',
  MU: 'MUR', MV: 'MVR', MW: 'MWK', MX: 'MXN', MY: 'MYR', MZ: 'MZN', NA: 'NAD', NC: 'XPF',
  NE: 'XOF', NF: 'AUD', NG: 'NGN', NI: 'NIO', NL: 'EUR', NO: 'NOK', NP: 'NPR', NR: 'AUD',
  NU: 'NZD', NZ: 'NZD', OM: 'OMR', PA: 'PAB', PE: 'PEN', PF: 'XPF', PG: 'PGK', PH: 'PHP',
  PK: 'PKR', PL: 'PLN', PM: 'EUR', PN: 'NZD', PR: 'USD', PS: 'ILS', PT: 'EUR', PW: 'USD',
  PY: 'PYG', QA: 'QAR', RE: 'EUR', RO: 'RON', RS: 'RSD', RU: 'RUB', RW: 'RWF', SA: 'SAR',
  SB: 'SBD', SC: 'SCR', SD: 'SDG', SE: 'SEK', SG: 'SGD', SH: 'SHP', SI: 'EUR', SJ: 'NOK',
  SK: 'EUR', SL: 'SLE', SM: 'EUR', SN: 'XOF', SO: 'SOS', SR: 'SRD', SS: 'SSP', ST: 'STN',
  SV: 'USD', SX: 'ANG', SY: 'SYP', SZ: 'SZL', TC: 'USD', TD: 'XAF', TF: 'EUR', TG: 'XOF',
  TH: 'THB', TJ: 'TJS', TK: 'NZD', TL: 'USD', TM: 'TMT', TN: 'TND', TO: 'TOP', TR: 'TRY', XK: 'EUR',
  TT: 'TTD', TV: 'AUD', TW: 'TWD', TZ: 'TZS', UA: 'UAH', UG: 'UGX', UM: 'USD', US: 'USD',
  UY: 'UYU', UZ: 'UZS', VA: 'EUR', VC: 'XCD', VE: 'VES', VG: 'USD', VI: 'USD', VN: 'VND',
  VU: 'VUV', WF: 'XPF', WS: 'WST', YE: 'YER', YT: 'EUR', ZA: 'ZAR', ZM: 'ZMW', ZW: 'ZWL',
};

const localeByCurrency: Partial<Record<CurrencyCode, string>> = {
  AED: 'en-AE', AFN: 'fa-AF', ALL: 'sq-AL', AMD: 'hy-AM', ANG: 'nl-CW', AOA: 'pt-AO',
  ARS: 'es-AR', AUD: 'en-AU', AZN: 'az-AZ', BDT: 'bn-BD', BGN: 'bg-BG', BHD: 'ar-BH',
  BRL: 'pt-BR', CAD: 'en-CA', CHF: 'de-CH', CLP: 'es-CL', CNY: 'zh-CN', COP: 'es-CO',
  CRC: 'es-CR', CVE: 'pt-CV', CZK: 'cs-CZ', DKK: 'da-DK', DOP: 'es-DO', DZD: 'ar-DZ',
  EGP: 'ar-EG', ETB: 'am-ET', EUR: 'en-IE', FJD: 'en-FJ', GBP: 'en-GB', GEL: 'ka-GE',
  GHS: 'en-GH', GMD: 'en-GM', GNF: 'fr-GN', GTQ: 'es-GT', GYD: 'en-GY', HKD: 'zh-HK',
  HNL: 'es-HN', HUF: 'hu-HU', IDR: 'id-ID', ILS: 'he-IL', INR: 'en-IN', IQD: 'ar-IQ',
  ISK: 'is-IS', JMD: 'en-JM', JOD: 'ar-JO', JPY: 'ja-JP', KES: 'en-KE', KHR: 'km-KH',
  KRW: 'ko-KR', KWD: 'ar-KW', KZT: 'kk-KZ', LKR: 'si-LK', MAD: 'ar-MA', MGA: 'mg-MG',
  MKD: 'mk-MK', MMK: 'my-MM', MNT: 'mn-MN', MOP: 'zh-MO', MUR: 'en-MU', MVR: 'dv-MV',
  MWK: 'en-MW', MXN: 'es-MX', MYR: 'ms-MY', MZN: 'pt-MZ', NAD: 'en-NA', NGN: 'en-NG',
  NIO: 'es-NI', NOK: 'nb-NO', NPR: 'ne-NP', NZD: 'en-NZ', OMR: 'ar-OM', PAB: 'es-PA',
  PEN: 'es-PE', PHP: 'en-PH', PKR: 'ur-PK', PLN: 'pl-PL', PYG: 'es-PY', QAR: 'ar-QA',
  RON: 'ro-RO', RUB: 'ru-RU', RWF: 'rw-RW', SAR: 'ar-SA', SEK: 'sv-SE', SGD: 'en-SG',
  SLE: 'en-SL', STN: 'pt-ST', SYP: 'ar-SY', THB: 'th-TH', TND: 'ar-TN', TRY: 'tr-TR',
  TTD: 'en-TT', TWD: 'zh-TW', TZS: 'sw-TZ', UAH: 'uk-UA', UGX: 'en-UG', USD: 'en-US',
  UYU: 'es-UY', UZS: 'uz-UZ', VES: 'es-VE', VND: 'vi-VN', XAF: 'fr-CM', XCD: 'en-AG',
  XOF: 'fr-SN', XPF: 'fr-PF', YER: 'ar-YE', ZAR: 'en-ZA', ZMW: 'en-ZM', ZWL: 'en-ZW',
};

function currencySymbol(locale: string, currency: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol',
    maximumFractionDigits: 0,
  }).formatToParts(0).find((part) => part.type === 'currency')?.value ?? currency;
}

function currencyLabel(currency: CurrencyCode): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'currency' }).of(currency) ?? currency;
  } catch {
    return currency;
  }
}

export const storeCurrencyOptions = storeCurrencyCodes.map((currency) => ({
  currency,
  label: currencyLabel(currency),
}));

function toCurrencyConfig(currency: CurrencyCode): CurrencyConfig {
  const locale = localeByCurrency[currency] ?? 'en-US';
  return { locale, currency, symbol: currencySymbol(locale, currency) };
}

export function currencyForCode(currency: string | null | undefined): CurrencyConfig {
  const code = currency?.toUpperCase() as CurrencyCode | undefined;
  return toCurrencyConfig(code && storeCurrencyCodes.includes(code) ? code : 'GHS');
}

export function currencyForLanguage(language: string | undefined): CurrencyConfig | null {
  const match = language?.match(/[-_]([A-Z]{2}|\d{3})(?:$|[-_])/i);
  const region = match?.[1]?.toUpperCase();
  const currency = region ? currencyByRegion[region] : undefined;
  return currency ? toCurrencyConfig(currency) : null;
}

export function countryNameForCode(country: string | null | undefined): string | null {
  if (!country) return null;
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(country.toUpperCase()) ?? country.toUpperCase();
  } catch {
    return country.toUpperCase();
  }
}

export const appCurrency = currencyForCode('GHS');
let activeCurrency = appCurrency;

export function setActiveCurrency(currency: string | CurrencyConfig): void {
  activeCurrency = typeof currency === 'string' ? currencyForCode(currency) : currency;
}

export function currentCurrency(): CurrencyConfig {
  return activeCurrency;
}

export function formatMoney(value: number | null | undefined): string {
  return new Intl.NumberFormat(activeCurrency.locale, {
    style: 'currency',
    currency: activeCurrency.currency,
  }).format(value ?? 0);
}

export function formatCompactMoney(value: number | null | undefined): string {
  return new Intl.NumberFormat(activeCurrency.locale, {
    style: 'currency',
    currency: activeCurrency.currency,
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}