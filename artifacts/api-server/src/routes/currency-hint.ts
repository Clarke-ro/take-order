import { Router, type IRouter, type RequestHandler } from "express";
import { CurrencyHintResponse } from "@workspace/api-zod";
import {
  countryFromAcceptLanguage,
  countryFromIp,
  currencyForCountry,
  requestClientIp,
} from "../lib/currency-detection";
import type { db } from "@workspace/db";

export function createCurrencyHintRouter(database: typeof db, requireSellerAuth: RequestHandler): IRouter {
  void database;
  const router: IRouter = Router();

  router.get("/currency-hint", requireSellerAuth, async (req, res): Promise<void> => {
    const cloudflareCountry = typeof req.headers["cf-ipcountry"] === "string"
      ? req.headers["cf-ipcountry"].toUpperCase()
      : undefined;
    const cloudflareCurrency = currencyForCountry(cloudflareCountry);
    if (cloudflareCurrency) {
      res.json(CurrencyHintResponse.parse({
        country: cloudflareCountry,
        currency: cloudflareCurrency,
        source: "cloudflare",
      }));
      return;
    }

    const geoCountry = await countryFromIp(requestClientIp(req));
    const geoCurrency = currencyForCountry(geoCountry);
    if (geoCurrency && geoCountry) {
      res.json(CurrencyHintResponse.parse({
        country: geoCountry,
        currency: geoCurrency,
        source: "geo_ip",
      }));
      return;
    }

    const languageCountry = countryFromAcceptLanguage(req.headers["accept-language"]);
    const languageCurrency = currencyForCountry(languageCountry);
    res.json(CurrencyHintResponse.parse({
      country: languageCountry ?? null,
      currency: languageCurrency ?? null,
      source: languageCurrency ? "accept_language" : "unknown",
    }));
  });

  return router;
}