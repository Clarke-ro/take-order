import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  type PlanTier,
  PLAN_DEFINITIONS,
  FREE_CATALOG_LIMIT,
  FREE_ACTIVE_LINK_LIMIT,
  PRO_ACTIVE_LINK_LIMIT,
  TRIAL_DURATION_DAYS,
  hasReachedCatalogLimit,
  hasReachedActiveLinkLimit,
  getTrialDaysRemaining,
  isTrialActive,
  isProOrHigher,
  isProPlus,
} from "@workspace/api-zod";

describe("entitlements - commercial model & limit logic", () => {
  it("locks commercial constants accurately", () => {
    assert.equal(FREE_CATALOG_LIMIT, null);
    assert.equal(FREE_ACTIVE_LINK_LIMIT, 50);
    assert.equal(TRIAL_DURATION_DAYS, 7);
    assert.equal(PRO_ACTIVE_LINK_LIMIT, 500);
  });

  it("defines capabilities correctly across all 4 tiers", () => {
    // Free: unlimited catalog, 50 links, no reports, no export, standard dashboard
    const free = PLAN_DEFINITIONS.free;
    assert.equal(free.catalogLimit.unlimited, true);
    assert.equal(free.catalogLimit.limit, null);
    assert.equal(free.activeLinkLimit.unlimited, false);
    assert.equal(free.activeLinkLimit.limit, 50);
    assert.equal(free.canAccessReports, false);
    assert.equal(free.canExportAnalytics, false);
    assert.equal(free.canAccessChannelConversion, false);
    assert.equal(free.dashboardExperience, "standard");

    // Trial: 7-day Pro access, unlimited catalog, 500 links, reports and export allowed
    const trial = PLAN_DEFINITIONS.trial;
    assert.equal(trial.catalogLimit.unlimited, true);
    assert.equal(trial.catalogLimit.limit, null);
    assert.equal(trial.activeLinkLimit.unlimited, false);
    assert.equal(trial.activeLinkLimit.limit, 500);
    assert.equal(trial.canAccessReports, true);
    assert.equal(trial.canExportAnalytics, true);
    assert.equal(trial.canAccessChannelConversion, true);
    assert.equal(trial.dashboardExperience, "advanced");

    // Pro: unlimited catalog, 500 links, reports and export allowed
    const pro = PLAN_DEFINITIONS.pro;
    assert.equal(pro.catalogLimit.unlimited, true);
    assert.equal(pro.catalogLimit.limit, null);
    assert.equal(pro.activeLinkLimit.unlimited, false);
    assert.equal(pro.activeLinkLimit.limit, 500);
    assert.equal(pro.canAccessReports, true);
    assert.equal(pro.canExportAnalytics, true);
    assert.equal(pro.canAccessChannelConversion, true);
    assert.equal(pro.dashboardExperience, "advanced");

    // Pro+: unlimited catalog, explicitly UNLIMITED links (no numerical ceiling)
    const proPlus = PLAN_DEFINITIONS.pro_plus;
    assert.equal(proPlus.catalogLimit.unlimited, true);
    assert.equal(proPlus.catalogLimit.limit, null);
    assert.equal(proPlus.activeLinkLimit.unlimited, true);
    assert.equal(proPlus.activeLinkLimit.limit, null); // Semantic unlimited
    assert.equal(proPlus.canAccessReports, true);
    assert.equal(proPlus.canExportAnalytics, true);
    assert.equal(proPlus.dashboardExperience, "premium");
  });

  it("evaluates 7-day Pro trial accurately", () => {
    const now = new Date("2026-09-30T12:00:00.000Z");

    // Just started today
    const startedToday = "2026-09-30T00:00:00.000Z";
    assert.equal(isTrialActive(startedToday, now), true);
    assert.equal(getTrialDaysRemaining(startedToday, now), 7);

    // 4 days in
    const started4DaysAgo = "2026-09-26T12:00:00.000Z";
    assert.equal(isTrialActive(started4DaysAgo, now), true);
    assert.equal(getTrialDaysRemaining(started4DaysAgo, now), 3);

    // 7 days and 1 hour ago (expired)
    const started8DaysAgo = "2026-09-22T12:00:00.000Z";
    assert.equal(isTrialActive(started8DaysAgo, now), false);
    assert.equal(getTrialDaysRemaining(started8DaysAgo, now), 0);
  });

  it("enforces catalog product limits strictly per tier", () => {
    // All tiers: catalog is unlimited
    assert.equal(hasReachedCatalogLimit(0, "free"), false);
    assert.equal(hasReachedCatalogLimit(10, "free"), false);
    assert.equal(hasReachedCatalogLimit(100, "free"), false);

    assert.equal(hasReachedCatalogLimit(10, "pro"), false);
    assert.equal(hasReachedCatalogLimit(500, "pro"), false);
    assert.equal(hasReachedCatalogLimit(10, "pro_plus"), false);
    assert.equal(hasReachedCatalogLimit(500, "pro_plus"), false);

    // Trial tier: inherits Pro unlimited catalog
    assert.equal(hasReachedCatalogLimit(10, "trial"), false);
    assert.equal(hasReachedCatalogLimit(500, "trial"), false);
  });

  it("enforces active Take Order link limits strictly per tier", () => {
    // Free tier: 0-49 allowed, 50 reaches limit, 51 blocked
    assert.equal(hasReachedActiveLinkLimit(0, "free"), false);
    assert.equal(hasReachedActiveLinkLimit(49, "free"), false);
    assert.equal(hasReachedActiveLinkLimit(50, "free"), true);
    assert.equal(hasReachedActiveLinkLimit(80, "free"), true);

    // Pro tier: allows up to PRO_ACTIVE_LINK_LIMIT (500)
    assert.equal(hasReachedActiveLinkLimit(50, "pro"), false);
    assert.equal(hasReachedActiveLinkLimit(499, "pro"), false);
    assert.equal(hasReachedActiveLinkLimit(500, "pro"), true);

    // Pro+ tier: unlimited links (no numerical ceiling)
    assert.equal(hasReachedActiveLinkLimit(50, "pro_plus"), false);
    assert.equal(hasReachedActiveLinkLimit(500, "pro_plus"), false);
    assert.equal(hasReachedActiveLinkLimit(50000, "pro_plus"), false);

    // Trial tier: inherits Pro link allowance (500)
    assert.equal(hasReachedActiveLinkLimit(50, "trial"), false);
    assert.equal(hasReachedActiveLinkLimit(499, "trial"), false);
    assert.equal(hasReachedActiveLinkLimit(500, "trial"), true);
  });

  it("checks Pro and Pro+ tier hierarchy correctly", () => {
    assert.equal(isProOrHigher("free"), false);
    assert.equal(isProOrHigher("trial"), true);
    assert.equal(isProOrHigher("pro"), true);
    assert.equal(isProOrHigher("pro_plus"), true);

    assert.equal(isProPlus("free"), false);
    assert.equal(isProPlus("trial"), false);
    assert.equal(isProPlus("pro"), false);
    assert.equal(isProPlus("pro_plus"), true);
  });
});
