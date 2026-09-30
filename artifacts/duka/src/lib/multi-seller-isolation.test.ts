import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readSellerProfile,
  writeSellerProfile,
  readOnboardingStep,
  writeOnboardingStep,
  readOnboardingComplete,
  finishOnboarding,
  readConnectedTools,
  writeConnectedTools,
  readChecklistDismissed,
  writeChecklistDismissed,
  clearAllSellerStorage,
  defaultSellerProfile,
} from './seller-storage.js';

class MockStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

test('two-account multi-seller data isolation: seller B sees completely empty onboarding with none of seller A details', () => {
  const storage = new MockStorage();

  const sellerA = 'user_seller_alice_123';
  const sellerB = 'user_seller_bob_456';

  // --- ACT 1: Seller A signs up and enters onboarding details ---
  const aliceInitialProfile = readSellerProfile(sellerA, storage);
  assert.equal(aliceInitialProfile.businessName, '', 'Seller A starts with empty business name');

  const aliceProfile = {
    ...defaultSellerProfile,
    firstName: 'Alice',
    lastName: 'Smith',
    sellerName: 'Alice Smith',
    businessName: "Alice's Boutique",
    description: 'Chic women fashion',
    category: 'Fashion & Apparel',
    phone: '+233201111111',
    whatsappPhone: '+233201111111',
    country: 'Ghana',
    currency: 'GHS',
    teamSize: '2-5 people',
    channels: ['whatsapp', 'instagram'],
  };

  writeSellerProfile(aliceProfile, sellerA, storage);
  writeOnboardingStep(3, sellerA, storage);
  writeConnectedTools(['WhatsApp', 'Instagram'], sellerA, storage);
  writeChecklistDismissed(sellerA, storage);
  finishOnboarding(sellerA, storage);

  // Assert Seller A data is persisted
  assert.equal(readSellerProfile(sellerA, storage).businessName, "Alice's Boutique");
  assert.equal(readOnboardingComplete(sellerA, storage), true);
  assert.equal(readOnboardingStep(sellerA, storage), 3);
  assert.deepEqual(readConnectedTools(sellerA, storage), ['WhatsApp', 'Instagram']);
  assert.equal(readChecklistDismissed(sellerA, storage), true);

  // --- ACT 2: Seller B signs up on the same browser (without clearing or after signing out) ---
  // Even if Seller A's data exists in storage under seller A's key,
  // Seller B MUST see a completely fresh, empty onboarding flow!
  const bobProfile = readSellerProfile(sellerB, storage);

  // Critical Assertions: None of Alice's data leaks into Bob's session
  assert.equal(bobProfile.businessName, '', "Seller B must NOT see Seller A's businessName");
  assert.equal(bobProfile.sellerName, '', "Seller B must NOT see Seller A's sellerName");
  assert.equal(bobProfile.firstName, '', "Seller B must NOT see Seller A's firstName");
  assert.equal(bobProfile.lastName, '', "Seller B must NOT see Seller A's lastName");
  assert.equal(bobProfile.phone, '', "Seller B must NOT see Seller A's phone");
  assert.equal(bobProfile.whatsappPhone, '', "Seller B must NOT see Seller A's whatsappPhone");
  assert.equal(bobProfile.category, '', "Seller B must NOT see Seller A's category");
  assert.notEqual(bobProfile.businessName, "Alice's Boutique");
  assert.notEqual(bobProfile.phone, '+233201111111');

  // Bob's onboarding status must be NOT completed and at Step 0
  assert.equal(readOnboardingComplete(sellerB, storage), false, 'Seller B onboarding must not be marked complete');
  assert.equal(readOnboardingStep(sellerB, storage), 0, 'Seller B must be at step 0');
  assert.deepEqual(readConnectedTools(sellerB, storage), [], 'Seller B must have no connected tools');
  assert.equal(readChecklistDismissed(sellerB, storage), false, 'Seller B checklist must not be dismissed');

  // --- ACT 3: Seller B enters their own onboarding details ---
  const bobCustomProfile = {
    ...defaultSellerProfile,
    firstName: 'Bob',
    lastName: 'Jones',
    sellerName: 'Bob Jones',
    businessName: "Bob's Kicks",
    description: 'Sneakers and footwear',
    category: 'Footwear',
    phone: '+1234567890',
    whatsappPhone: '+1234567890',
    country: 'United States',
    currency: 'USD',
    teamSize: 'Just me',
    channels: ['tiktok'],
  };

  writeSellerProfile(bobCustomProfile, sellerB, storage);
  writeOnboardingStep(1, sellerB, storage);

  // Assert Bob has Bob's data
  assert.equal(readSellerProfile(sellerB, storage).businessName, "Bob's Kicks");
  assert.equal(readSellerProfile(sellerB, storage).phone, '+1234567890');

  // Assert Alice STILL has Alice's data intact and isolated
  assert.equal(readSellerProfile(sellerA, storage).businessName, "Alice's Boutique");
  assert.equal(readSellerProfile(sellerA, storage).phone, '+233201111111');
  assert.equal(readOnboardingComplete(sellerA, storage), true);

  // --- ACT 4: Test Sign Out Wipe ---
  clearAllSellerStorage(storage);
  assert.equal(readSellerProfile(sellerA, storage).businessName, '');
  assert.equal(readSellerProfile(sellerB, storage).businessName, '');
  assert.equal(readOnboardingComplete(sellerA, storage), false);
  assert.equal(readOnboardingComplete(sellerB, storage), false);
});
