/** dd/mm/yyyy */
export function formatDisplayDate(date: Date = new Date()): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** hh:mm:ss AM/PM (12-hour) */
export function formatDisplayTime(date: Date = new Date()): string {
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
}

export function formatDisplayDateTime(date: Date = new Date()): string {
  return `${formatDisplayDate(date)} ${formatDisplayTime(date)}`;
}

/** yyyy-mm-dd for filenames */
export function formatFilenameDate(date: Date = new Date()): string {
  return formatDisplayDate(date).replace(/\//g, '-');
}

export function parseStoredDateTime(value: string): Date | null {
  const v = value.trim();
  if (!v) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(v) || /^\d{4}-\d{2}-\d{2} /.test(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const dmY = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/);
  if (dmY) {
    return new Date(Number(dmY[3]), Number(dmY[2]) - 1, Number(dmY[1]));
  }

  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatStoredDateTime(value?: string | null, fallback = '—'): string {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  const parsed = parseStoredDateTime(raw);
  if (!parsed) return raw;
  return formatDisplayDateTime(parsed);
}

export function toDateInputValue(value?: string | null): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const parsed = parseStoredDateTime(raw);
  if (!parsed) return raw.slice(0, 10);
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function isDateFieldLabel(label: string): boolean {
  return /date|warranty start|warranty exp|amc start|amc end|assigned date|created|updated|purchase date|maintenance|missing|damage|recovered/i.test(
    label
  );
}
