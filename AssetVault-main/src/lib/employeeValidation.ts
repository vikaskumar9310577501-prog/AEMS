import { validateEmailFormat, isGmailAddress } from './emailValidation';

export const EMPLOYEE_ID_EXISTS_MESSAGE = 'User already exists';

export function isEmployeeIdExistsError(message?: string): boolean {
  if (!message) return false;
  const normalized = message.trim().toLowerCase();
  return (
    normalized === EMPLOYEE_ID_EXISTS_MESSAGE.toLowerCase() ||
    normalized.includes('employee with this id already exists') ||
    normalized.includes('employee id already exists') ||
    normalized.includes('user already exists')
  );
}

/** Company email only — blocks Gmail; allows @pgel.in and other valid domains. */
export function validateEmployeeEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return 'Email is required';
  const formatErr = validateEmailFormat(trimmed);
  if (formatErr) return formatErr === 'Email is required' ? formatErr : 'Enter a valid email address';
  if (isGmailAddress(trimmed)) {
    return 'Invalid email — Gmail is not allowed. Use company email (e.g. name@pgel.in)';
  }
  return null;
}

/** When provided, phone must be exactly 10 digits with no letters or symbols. */
export function validateEmployeePhone(phone: string, required = false): string | null {
  const trimmed = String(phone || '').trim();
  if (!trimmed) return required ? 'Phone number is required' : null;
  if (!/^\d{10}$/.test(trimmed)) {
    return 'Phone number must be exactly 10 digits';
  }
  return null;
}

export function normalizeEmployeePhoneInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10);
}

export function validateEmployeePayload(
  payload: Partial<{ employeeId: string; name: string; email: string; phone: string; department: string }>,
  options?: { requirePhone?: boolean }
): string | null {
  if (!String(payload.employeeId || '').trim()) return 'Employee ID is required';
  if (!String(payload.name || '').trim()) return 'Name is required';
  const emailErr = validateEmployeeEmail(String(payload.email || ''));
  if (emailErr) return emailErr;
  if (!String(payload.department || '').trim()) return 'Department is required';
  const phoneErr = validateEmployeePhone(String(payload.phone || ''), options?.requirePhone);
  if (phoneErr) return phoneErr;
  return null;
}
