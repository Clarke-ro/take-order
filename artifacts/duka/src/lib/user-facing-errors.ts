/**
 * Clean user-facing error abstraction for Take Order.
 * Translates low-level network, database, or server errors into friendly, actionable copy.
 */

export function formatUserFacingError(error: unknown, fallbackMessage: string = 'An unexpected error occurred. Please try again.'): string {
  if (!error) return fallbackMessage;

  const rawMessage = error instanceof Error 
    ? error.message 
    : typeof error === 'string' 
      ? error 
      : typeof error === 'object' && error !== null && 'error' in error && typeof (error as { error: unknown }).error === 'string'
        ? (error as { error: string }).error
        : '';

  if (!rawMessage) return fallbackMessage;

  const lower = rawMessage.toLowerCase();

  // Network / Offline / Connection errors
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('connection refused') ||
    lower.includes('econnrefused') ||
    lower.includes('offline') ||
    lower.includes('aborted')
  ) {
    return 'Unable to reach your store. Please check your internet connection and try again.';
  }

  // Authentication & session errors
  if (
    lower.includes('unauthorized') ||
    lower.includes('not authenticated') ||
    lower.includes('jwt') ||
    lower.includes('session expired') ||
    lower.includes('401')
  ) {
    return 'Your session has expired. Please sign in again to continue.';
  }

  // Permission errors
  if (lower.includes('forbidden') || lower.includes('permission denied') || lower.includes('403')) {
    return 'You do not have permission to perform this action.';
  }

  // Not found errors
  if (lower.includes('not found') || lower.includes('404')) {
    return 'The requested record or item could not be found.';
  }

  // Server & Database errors (Supabase / Postgres / Drizzle)
  if (
    lower.includes('500') ||
    lower.includes('internal server error') ||
    lower.includes('postgres') ||
    lower.includes('postgrest') ||
    lower.includes('violates foreign key') ||
    lower.includes('syntax error at or near') ||
    lower.includes('relation') ||
    lower.includes('column') ||
    lower.includes('drizzle')
  ) {
    return 'We encountered a momentary issue saving your information. Your data is safe. Please try again in a moment.';
  }

  // Duplicate / Unique constraint errors
  if (lower.includes('already exists') || lower.includes('duplicate') || lower.includes('unique constraint')) {
    return 'An item or record with these details already exists in your workspace.';
  }

  // Validation errors that are already friendly (short, non-code strings)
  if (
    rawMessage.length < 120 &&
    !rawMessage.includes('{') &&
    !rawMessage.includes('}') &&
    !rawMessage.includes('at ') &&
    !rawMessage.includes('Error:') &&
    !rawMessage.includes('SELECT') &&
    !rawMessage.includes('INSERT')
  ) {
    return rawMessage;
  }

  return fallbackMessage;
}

