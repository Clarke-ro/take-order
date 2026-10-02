/**
 * Resolves a validated, safe internal redirect path.
 * Protects against open-redirect vulnerabilities and self-redirect loops.
 */
export function getSafeRedirectUrl(searchQueryString: string = '', fallback: string = '/dashboard'): string {
  try {
    const params = new URLSearchParams(searchQueryString);
    const redirect = params.get('redirect');
    if (
      redirect &&
      redirect.startsWith('/') &&
      !redirect.startsWith('//') &&
      !redirect.startsWith('/sign-in') &&
      !redirect.startsWith('/sign-up')
    ) {
      return redirect;
    }
  } catch {
    // Return fallback on malformed query strings
  }
  return fallback;
}
