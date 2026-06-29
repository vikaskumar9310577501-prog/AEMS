const EMAIL_FORMAT =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/** Personal Gmail domains blocked for corporate email fields. */
export function isGmailAddress(email: string): boolean {
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1];
  return domain === 'gmail.com' || domain === 'googlemail.com';
}

/** Validates standard email shape (any TLD such as .com, .in, .org). */
export function validateEmailFormat(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return 'Email is required';
  if (!EMAIL_FORMAT.test(trimmed)) return 'Enter a valid email address';
  return null;
}

export function validateCorporateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return null;
  const formatErr = validateEmailFormat(trimmed);
  if (formatErr) return formatErr;
  if (isGmailAddress(trimmed)) {
    return 'Invalid email — Gmail is not allowed';
  }
  return null;
}
