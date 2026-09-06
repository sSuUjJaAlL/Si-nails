import { formatInTimeZone } from 'date-fns-tz';

export const TZ = 'Asia/Kathmandu';

export function formatDateNp(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(d, TZ, 'dd MMM yyyy');
}

export function formatTimeDisplay(time: string): string {
  // Accept HH:mm (24h) and return 12h with AM/PM
  const [hStr, mStr] = time.split(':');
  let h = Number(hStr);
  const m = mStr || '00';
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, '0')}:${m} ${period}`;
}

export function parseDateOnly(value: string): Date {
  // Expect YYYY-MM-DD
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toDateString(date: Date): string {
  return formatInTimeZone(date, TZ, 'yyyy-MM-dd');
}

export function startOfDayKathmandu(date = new Date()): Date {
  const ymd = formatInTimeZone(date, TZ, 'yyyy-MM-dd');
  return parseDateOnly(ymd);
}

export function formatNrs(amount: number | string): string {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  return `NPR ${n.toLocaleString('en-NP')}`;
}

export function decimalToNumber(value: { toString(): string } | number | string): number {
  return Number(value.toString());
}
