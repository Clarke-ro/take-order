import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isProActive,
  isProPlusActive,
  getActivePlanTier,
  getActiveEntitlementDetails,
  isUserCancelledError,
  formatPackagePrice,
  formatPackageMonthlyEquivalent,
  PRO_ENTITLEMENT_ID,
  PRO_PLUS_ENTITLEMENT_ID,
  PACKAGE_ID_PRO_MONTHLY,
  PACKAGE_ID_PRO_ANNUAL,
  PACKAGE_ID_PRO_PLUS_MONTHLY,
  PACKAGE_ID_PRO_PLUS_ANNUAL,
  REVENUECAT_API_KEY,
  subscribeToEntitlementChanges,
  notifyEntitlementUpdated,
} from './revenuecat';
import { ErrorCode } from '@revenuecat/purchases-js';

test('RevenueCat configuration has correct default public API key and package constants', () => {
  assert.equal(REVENUECAT_API_KEY, 'rcb_sb_HXGmjiScvdUHSTWLYKCOQgWBl');
  assert.equal(PRO_ENTITLEMENT_ID, 'take_order_app_pro');
  assert.equal(PRO_PLUS_ENTITLEMENT_ID, 'take_order_app_pro_plus');
  assert.equal(PACKAGE_ID_PRO_MONTHLY, '$rc_monthly');
  assert.equal(PACKAGE_ID_PRO_ANNUAL, '$rc_annual');
  assert.equal(PACKAGE_ID_PRO_PLUS_MONTHLY, '$rc_custom_proplus_monthly');
  assert.equal(PACKAGE_ID_PRO_PLUS_ANNUAL, '$rc_custom_proplus_annual');
});

test('isProActive and isProPlusActive correctly identify entitlements', () => {
  assert.equal(isProActive(null), false);
  assert.equal(isProPlusActive(null), false);
  assert.equal(isProActive(undefined), false);
  assert.equal(isProActive({} as any), false);
  assert.equal(isProActive({ entitlements: { active: {} } } as any), false);

  const nonProInfo = {
    entitlements: {
      active: {
        other_feature: { identifier: 'other_feature' },
      },
    },
  };
  assert.equal(isProActive(nonProInfo as any), false);
  assert.equal(isProPlusActive(nonProInfo as any), false);

  const proInfo = {
    entitlements: {
      active: {
        take_order_app_pro: { identifier: 'take_order_app_pro', isActive: true },
      },
    },
  };
  assert.equal(isProActive(proInfo as any), true);
  assert.equal(isProPlusActive(proInfo as any), false);

  const proPlusInfo = {
    entitlements: {
      active: {
        take_order_app_pro_plus: { identifier: 'take_order_app_pro_plus', isActive: true },
      },
    },
  };
  assert.equal(isProPlusActive(proPlusInfo as any), true);
});

test('getActivePlanTier and getActiveEntitlementDetails accurately classify subscription state', () => {
  assert.equal(getActivePlanTier(null), 'none');
  const detailsEmpty = getActiveEntitlementDetails(null);
  assert.equal(detailsEmpty.hasActivePlan, false);
  assert.equal(detailsEmpty.tier, 'none');

  const proInfo = {
    managementURL: 'https://billing.revenuecat.com/manage/sub123',
    entitlements: {
      active: {
        take_order_app_pro: {
          identifier: 'take_order_app_pro',
          productIdentifier: '$rc_annual',
          willRenew: true,
          expirationDate: new Date('2027-01-01'),
        },
      },
    },
  };
  assert.equal(getActivePlanTier(proInfo as any), 'pro');
  const proDetails = getActiveEntitlementDetails(proInfo as any);
  assert.equal(proDetails.hasActivePlan, true);
  assert.equal(proDetails.tier, 'pro');
  assert.equal(proDetails.planName, 'Pro');
  assert.equal(proDetails.cadence, 'annual');
  assert.equal(proDetails.willRenew, true);
  assert.equal(proDetails.managementURL, 'https://billing.revenuecat.com/manage/sub123');

  const proPlusInfo = {
    managementURL: 'https://billing.revenuecat.com/manage/sub456',
    entitlements: {
      active: {
        take_order_app_pro_plus: {
          identifier: 'take_order_app_pro_plus',
          productIdentifier: '$rc_custom_proplus_monthly',
          willRenew: false,
          expirationDate: new Date('2026-10-15'),
        },
      },
    },
  };
  assert.equal(getActivePlanTier(proPlusInfo as any), 'pro_plus');
  const proPlusDetails = getActiveEntitlementDetails(proPlusInfo as any);
  assert.equal(proPlusDetails.hasActivePlan, true);
  assert.equal(proPlusDetails.tier, 'pro_plus');
  assert.equal(proPlusDetails.planName, 'Pro+');
  assert.equal(proPlusDetails.cadence, 'monthly');
  assert.equal(proPlusDetails.willRenew, false);
});

test('formatPackagePrice and formatPackageMonthlyEquivalent format prices from webBillingProduct', () => {
  assert.equal(formatPackagePrice(null, '$9.99/mo'), '$9.99/mo');

  const mockPkg = {
    identifier: '$rc_annual',
    webBillingProduct: {
      identifier: '$rc_annual',
      title: 'Pro Annual',
      currentPrice: {
        amount: 8991,
        amountMicros: 89910000,
        currency: 'USD',
        formattedPrice: '$89.91',
      },
    },
  };

  assert.equal(formatPackagePrice(mockPkg as any), '$89.91');
  assert.equal(formatPackageMonthlyEquivalent(mockPkg as any), '$7.49/mo equiv.');
});

test('isUserCancelledError catches user cancelled errors without throwing', () => {
  assert.equal(isUserCancelledError(null), false);
  assert.equal(isUserCancelledError(undefined), false);

  const errorWithCode = { errorCode: ErrorCode.UserCancelledError };
  assert.equal(isUserCancelledError(errorWithCode), true);

  const errorWithCode1 = { errorCode: 1 };
  assert.equal(isUserCancelledError(errorWithCode1), true);

  const errorWithName = { name: 'UserCancelledError' };
  assert.equal(isUserCancelledError(errorWithName), true);

  const errorWithMessage = new Error('The user cancelled the checkout window');
  assert.equal(isUserCancelledError(errorWithMessage), true);

  const genericError = new Error('Network error or payment declined');
  assert.equal(isUserCancelledError(genericError), false);
});

test('subscribeToEntitlementChanges notifies subscribers on entitlement updates', () => {
  let callCount = 0;
  let receivedPro = false;

  const unsubscribe = subscribeToEntitlementChanges((info, pro) => {
    callCount++;
    receivedPro = pro;
  });

  const mockCustomerInfo = {
    entitlements: {
      active: {
        take_order_app_pro: { identifier: 'take_order_app_pro' },
      },
    },
  };

  notifyEntitlementUpdated(mockCustomerInfo as any);
  assert.equal(callCount, 1);
  assert.equal(receivedPro, true);

  unsubscribe();
  notifyEntitlementUpdated(null);
  assert.equal(callCount, 1); // Should not increase after unsubscribe
});
