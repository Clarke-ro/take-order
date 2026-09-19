import type { Request } from "express";

const countryCurrency: Record<string, string> = {
  AD: "EUR", AE: "AED", AF: "AFN", AG: "XCD", AI: "XCD", AL: "ALL", AM: "AMD", AO: "AOA",
  AR: "ARS", AS: "USD", AT: "EUR", AU: "AUD", AW: "AWG", AX: "EUR", AZ: "AZN",
  BA: "BAM", BB: "BBD", BD: "BDT", BE: "EUR", BF: "XOF", BG: "BGN", BH: "BHD", BI: "BIF",
  BJ: "XOF", BL: "EUR", BM: "BMD", BN: "BND", BO: "BOB", BQ: "USD", BR: "BRL", BS: "BSD",
  BT: "BTN", BV: "NOK", BW: "BWP", BY: "BYN", BZ: "BZD", CA: "CAD", CC: "AUD", CD: "CDF",
  CF: "XAF", CG: "XAF", CH: "CHF", CI: "XOF", CK: "NZD", CL: "CLP", CM: "XAF", CN: "CNY",
  CO: "COP", CR: "CRC", CU: "CUP", CV: "CVE", CW: "ANG", CX: "AUD", CY: "EUR", CZ: "CZK",
  DE: "EUR", DJ: "DJF", DK: "DKK", DM: "XCD", DO: "DOP", DZ: "DZD", EC: "USD", EE: "EUR",
  EG: "EGP", EH: "MAD", ER: "ERN", ES: "EUR", ET: "ETB", FI: "EUR", FJ: "FJD", FK: "FKP",
  FM: "USD", FO: "DKK", FR: "EUR", GA: "XAF", GB: "GBP", GD: "XCD", GE: "GEL", GF: "EUR",
  GG: "GBP", GH: "GHS", GI: "GIP", GL: "DKK", GM: "GMD", GN: "GNF", GP: "EUR", GQ: "XAF",
  GR: "EUR", GS: "GBP", GT: "GTQ", GU: "USD", GW: "XOF", GY: "GYD", HK: "HKD", HM: "AUD",
  HN: "HNL", HR: "EUR", HT: "HTG", HU: "HUF", ID: "IDR", IE: "EUR", IL: "ILS", IM: "GBP",
  IN: "INR", IO: "USD", IQ: "IQD", IR: "IRR", IS: "ISK", IT: "EUR", JE: "GBP", JM: "JMD", XK: "EUR",
  JO: "JOD", JP: "JPY", KE: "KES", KG: "KGS", KH: "KHR", KI: "AUD", KM: "KMF", KN: "XCD",
  KP: "KPW", KR: "KRW", KW: "KWD", KY: "KYD", KZ: "KZT", LA: "LAK", LB: "LBP", LC: "XCD",
  LI: "CHF", LK: "LKR", LR: "LRD", LS: "LSL", LT: "EUR", LU: "EUR", LV: "EUR", LY: "LYD",
  MA: "MAD", MC: "EUR", MD: "MDL", ME: "EUR", MF: "EUR", MG: "MGA", MH: "USD", MK: "MKD",
  ML: "XOF", MM: "MMK", MN: "MNT", MO: "MOP", MP: "USD", MQ: "EUR", MR: "MRU", MS: "XCD",
  MT: "EUR", MU: "MUR", MV: "MVR", MW: "MWK", MX: "MXN", MY: "MYR", MZ: "MZN", NA: "NAD",
  NC: "XPF", NE: "XOF", NF: "AUD", NG: "NGN", NI: "NIO", NL: "EUR", NO: "NOK", NP: "NPR",
  NR: "AUD", NU: "NZD", NZ: "NZD", OM: "OMR", PA: "PAB", PE: "PEN", PF: "XPF", PG: "PGK",
  PH: "PHP", PK: "PKR", PL: "PLN", PM: "EUR", PN: "NZD", PR: "USD", PS: "ILS", PT: "EUR",
  PW: "USD", PY: "PYG", QA: "QAR", RE: "EUR", RO: "RON", RS: "RSD", RU: "RUB", RW: "RWF",
  SA: "SAR", SB: "SBD", SC: "SCR", SD: "SDG", SE: "SEK", SG: "SGD", SH: "SHP", SI: "EUR",
  SJ: "NOK", SK: "EUR", SL: "SLE", SM: "EUR", SN: "XOF", SO: "SOS", SR: "SRD", SS: "SSP",
  ST: "STN", SV: "USD", SX: "ANG", SY: "SYP", SZ: "SZL", TC: "USD", TD: "XAF", TF: "EUR",
  TG: "XOF", TH: "THB", TJ: "TJS", TK: "NZD", TL: "USD", TM: "TMT", TN: "TND", TO: "TOP",
  TR: "TRY", TT: "TTD", TV: "AUD", TW: "TWD", TZ: "TZS", UA: "UAH", UG: "UGX", UM: "USD",
  US: "USD", UY: "UYU", UZ: "UZS", VA: "EUR", VC: "XCD", VE: "VES", VG: "USD", VI: "USD",
  VN: "VND", VU: "VUV", WF: "XPF", WS: "WST", YE: "YER", YT: "EUR", ZA: "ZAR", ZM: "ZMW",
  ZW: "ZWL",
};

const languageRegion = (language: string | undefined): string | undefined => {
  const match = language?.match(/[-_]([A-Z]{2}|\d{3})(?:$|[-_])/i);
  return match?.[1]?.toUpperCase();
};

export function currencyForCountry(country: string | undefined): string | undefined {
  return countryCurrency[country?.trim().toUpperCase() ?? ""];
}

export function countryFromAcceptLanguage(header: string | undefined): string | undefined {
  for (const language of header?.split(",") ?? []) {
    const region = languageRegion(language.split(";")[0]?.trim());
    if (region && countryCurrency[region]) return region;
  }
  return undefined;
}

function firstForwardedValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(",")[0]?.trim() || undefined;
}

export function requestClientIp(req: Request): string | undefined {
  return firstForwardedValue(req.headers["cf-connecting-ip"])
    ?? firstForwardedValue(req.headers["x-forwarded-for"])
    ?? req.socket.remoteAddress
    ?? undefined;
}

function isPrivateOrLocalIp(ip: string | undefined): boolean {
  if (!ip) return true;
  const normalized = ip.replace(/^::ffff:/, "").trim();
  if (normalized === "::1" || normalized === "127.0.0.1" || normalized === "localhost") return true;
  if (normalized.includes(":")) return normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
  const octets = normalized.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return true;
  return octets[0] === 10 || octets[0] === 127 || (octets[0] === 192 && octets[1] === 168)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31);
}

export async function countryFromIp(ip: string | undefined): Promise<string | undefined> {
  if (isPrivateOrLocalIp(ip)) return undefined;
  try {
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip!)}/country/`, {
      headers: { accept: "text/plain" },
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return undefined;
    const country = (await response.text()).trim().toUpperCase();
    return countryCurrency[country] ? country : undefined;
  } catch {
    return undefined;
  }
}