import assert from "node:assert/strict";
import test from "node:test";
import {
  countryFromAcceptLanguage,
  currencyForCountry,
  countryFromIp,
} from "./currency-detection";

test("maps Cloudflare country codes through the complete currency table", () => {
  assert.equal(currencyForCountry("GH"), "GHS");
  assert.equal(currencyForCountry("JP"), "JPY");
  assert.equal(currencyForCountry("XK"), "EUR");
  assert.equal(currencyForCountry("unknown"), undefined);
});

test("uses the region from the first supported Accept-Language value", () => {
  assert.equal(countryFromAcceptLanguage("en-GB,en;q=0.8"), "GB");
  assert.equal(countryFromAcceptLanguage("en;q=0.8,pt-GH;q=0.7"), "GH");
  assert.equal(countryFromAcceptLanguage("en"), undefined);
});

test("does not send private development addresses to the geo-IP service", async () => {
  assert.equal(await countryFromIp("127.0.0.1"), undefined);
  assert.equal(await countryFromIp("192.168.1.20"), undefined);
});