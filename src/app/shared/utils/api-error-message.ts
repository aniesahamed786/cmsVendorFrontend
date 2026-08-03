import { HttpErrorResponse } from '@angular/common/http';

/**
 * Pull the human-readable message out of a NestJS error body.
 *
 * The backend answers with `{ message, error, statusCode }`, where `message` is a string for
 * thrown HttpExceptions (e.g. the 409 raised when an UPDATE request for the same offer is
 * already in progress) and a string[] when class-validator rejects the body. These messages
 * are written for the user and carry detail the UI cannot reconstruct — such as the
 * conflicting requestId and its status — so prefer them over a generic fallback.
 *
 * Returns null when there is nothing useful to show (network failures, empty bodies), so
 * callers can fall back to their own translated copy.
 */
export function extractApiErrorMessage(error: unknown): string | null {
  const body = (error as HttpErrorResponse)?.error ?? error;

  if (typeof body === 'string') {
    const trimmed = body.trim();
    // A stringified HTML error page is noise, not a message.
    return trimmed && !trimmed.startsWith('<') ? trimmed : null;
  }

  const message = (body as { message?: unknown })?.message;

  if (typeof message === 'string' && message.trim()) {
    return message.trim();
  }

  if (Array.isArray(message)) {
    const joined = message
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .join('\n');
    return joined || null;
  }

  return null;
}
