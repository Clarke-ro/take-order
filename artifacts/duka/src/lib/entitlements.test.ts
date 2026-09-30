import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FREE_CATALOG_LIMIT,
  FREE_ACTIVE_LINK_LIMIT,
  PRO_ACTIVE_LINK_LIMIT,
  TRIAL_DURATION_DAYS,
  PLAN_DEFINITIONS,
} from './entitlements';

test('commercial constants: locked accurately in frontend entitlements', () => {
  assert.equal(FREE_CATALOG_LIMIT, null);
  assert.equal(FREE_ACTIVE_LINK_LIMIT, 50);
  assert.equal(PRO_ACTIVE_LINK_LIMIT, 500);
  assert.equal(TRIAL_DURATION_DAYS, 7);
});

test('plan capabilities: Free plan allows standard core commerce up to limits', () => {
  const free = PLAN_DEFINITIONS.free;
  assert.equal(free.catalogLimit.unlimited, true);
  assert.equal(free.catalogLimit.limit, null);
  assert.equal(free.activeLinkLimit.unlimited, false);
  assert.equal(free.activeLinkLimit.limit, 50);
  assert.equal(free.canAccessReports, false);
  assert.equal(free.canExportAnalytics, false);
  assert.equal(free.canAccessChannelConversion, false);
  assert.equal(free.canAccessAdvancedComparisons, false);
  assert.equal(free.dashboardExperience, 'standard');
});

test('plan capabilities: Pro Trial has 7-day Pro access with no credit card required', () => {
  const trial = PLAN_DEFINITIONS.trial;
  assert.equal(TRIAL_DURATION_DAYS, 7);
  assert.equal(trial.catalogLimit.unlimited, true);
  assert.equal(trial.catalogLimit.limit, null);
  assert.equal(trial.activeLinkLimit.unlimited, false);
  assert.equal(trial.activeLinkLimit.limit, 500);
  assert.equal(trial.canAccessReports, true);
  assert.equal(trial.canExportAnalytics, true);
  assert.equal(trial.canAccessChannelConversion, true);
  assert.equal(trial.canAccessAdvancedComparisons, true);
  assert.equal(trial.dashboardExperience, 'advanced');
});

test('plan capabilities: Pro+ plan defines active links semantically unlimited', () => {
  const proPlus = PLAN_DEFINITIONS.pro_plus;
  assert.equal(proPlus.catalogLimit.unlimited, true);
  assert.equal(proPlus.catalogLimit.limit, null);
  assert.equal(proPlus.activeLinkLimit.unlimited, true);
  assert.equal(proPlus.activeLinkLimit.limit, null);
  assert.equal(proPlus.canAccessReports, true);
  assert.equal(proPlus.dashboardExperience, 'premium');
});
