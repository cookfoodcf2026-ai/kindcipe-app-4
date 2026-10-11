/**
 * In-memory handoff for the email-verification flow.
 *
 * The email must NOT travel through the route URL: on web, Expo Router turns
 * route params into a query string (`/verify-email?email=...`), which leaks PII
 * into browser history, the `Referer` header and server access logs.
 *
 * Login stores the email here and the verify screen reads it back. A hard
 * refresh clears it, in which case the user simply re-enters the flow.
 */
let pendingVerificationEmail: string | null = null;

export function setPendingVerificationEmail(email: string | null | undefined): void {
  pendingVerificationEmail = email?.trim() || null;
}

export function getPendingVerificationEmail(): string | null {
  return pendingVerificationEmail;
}

export function clearPendingVerificationEmail(): void {
  pendingVerificationEmail = null;
}
