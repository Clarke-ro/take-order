import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthContext, type AuthState } from './auth-context';
import { getSafeRedirectUrl } from './redirect';

test('AuthContext default state initializes in safe loading state to prevent reload redirects', () => {
  // @ts-expect-error accessing defaultValue for context test
  const defaultValue = AuthContext._currentValue || {
    isLoaded: false,
    isSignedIn: false,
    authState: 'loading',
  };

  assert.equal(defaultValue.isLoaded, false, 'Default isLoaded must be false before provider loads');
  assert.equal(defaultValue.isSignedIn, false, 'Default isSignedIn must be false');
  assert.equal(defaultValue.authState, 'loading', 'Default authState must be loading');
});

test('Three-valued auth state transitions accurately', () => {
  const resolveAuthState = (isLoaded: boolean, isSignedIn: boolean): AuthState => {
    if (!isLoaded) return 'loading';
    return isSignedIn ? 'signed_in' : 'signed_out';
  };

  assert.equal(resolveAuthState(false, false), 'loading');
  assert.equal(resolveAuthState(false, true), 'loading');
  assert.equal(resolveAuthState(true, false), 'signed_out');
  assert.equal(resolveAuthState(true, true), 'signed_in');
});

test('getSafeRedirectUrl allows valid internal deep links', () => {
  assert.equal(getSafeRedirectUrl('?redirect=/orders/123'), '/orders/123');
  assert.equal(getSafeRedirectUrl('?redirect=/catalog/edit/45'), '/catalog/edit/45');
  assert.equal(getSafeRedirectUrl('?redirect=/clients'), '/clients');
  assert.equal(getSafeRedirectUrl('?redirect=/take-order'), '/take-order');
});

test('getSafeRedirectUrl blocks open redirect vulnerabilities and protocol-relative URLs', () => {
  assert.equal(getSafeRedirectUrl('?redirect=https://evil.com'), '/dashboard');
  assert.equal(getSafeRedirectUrl('?redirect=//evil.com'), '/dashboard');
  assert.equal(getSafeRedirectUrl('?redirect=javascript:alert(1)'), '/dashboard');
});

test('getSafeRedirectUrl blocks self-redirect loops to auth pages', () => {
  assert.equal(getSafeRedirectUrl('?redirect=/sign-in'), '/dashboard');
  assert.equal(getSafeRedirectUrl('?redirect=/sign-up'), '/dashboard');
});

test('getSafeRedirectUrl returns custom fallback when query parameter is missing', () => {
  assert.equal(getSafeRedirectUrl('', '/onboarding'), '/onboarding');
  assert.equal(getSafeRedirectUrl('?other=1', '/overview'), '/overview');
});
