export interface DateParts {
  day: string;
  month: string;
  year: string;
}

function excelSerialToParts(serial: number): DateParts | null {
  if (serial < 1 || serial > 100000) return null;
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
  const d = new Date(utc);
  if (Number.isNaN(d.getTime())) return null;
  return {
    year: String(d.getUTCFullYear()),
    month: String(d.getUTCMonth() + 1).padStart(2, "0"),
    day: String(d.getUTCDate()).padStart(2, "0"),
  };
}

export function parseStoredDate(stored: string): DateParts {
  if (!stored?.trim()) return { day: "", month: "", year: "" };
  const s = stored.trim();

  if (/^\d{1,4}$/.test(s)) {
    return { day: "", month: "", year: s };
  }

  const ym = s.match(/^(\d{4})-(\d{1,2})$/);
  if (ym) {
    return { day: "", month: ym[2].padStart(2, "0"), year: ym[1] };
  }

  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) {
    return {
      year: ymd[1],
      month: ymd[2].padStart(2, "0"),
      day: ymd[3].padStart(2, "0"),
    };
  }

  const iso = s.includes("T") ? s.split("T")[0] : s;
  const isoM = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoM) {
    return { year: isoM[1], month: isoM[2], day: isoM[3] };
  }

  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) {
    return {
      day: dmy[1].padStart(2, "0"),
      month: dmy[2].padStart(2, "0"),
      year: dmy[3],
    };
  }

  if (/^\d{4,6}(\.\d+)?$/.test(s)) {
    const parts = excelSerialToParts(parseFloat(s));
    if (parts) return parts;
  }

  const parsedMs = Date.parse(s);
  if (!Number.isNaN(parsedMs)) {
    const d = new Date(parsedMs);
    return {
      year: String(d.getFullYear()),
      month: String(d.getMonth() + 1).padStart(2, "0"),
      day: String(d.getDate()).padStart(2, "0"),
    };
  }

  return { day: "", month: "", year: "" };
}

export function partsToStored(parts: DateParts): string {
  const y = parts.year.trim();
  const mo = parts.month.trim();
  const d = parts.day.trim();
  if (!y) return "";
  if (!mo) return y;
  if (!d) return `${y}-${mo.padStart(2, "0")}`;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export function normalizeWarrantyDate(raw?: string): string {
  if (!raw?.trim()) return "";
  const parts = parseStoredDate(raw.trim());
  const stored = partsToStored(parts);
  return stored || raw.trim();
}
