// Pure date helpers. Schedule dates are Asia/Seoul calendar dates ("YYYY-MM-DD"),
// which has no daylight saving time, so a fixed +09:00 offset is exact.
export const SEOUL_OFFSET = "+09:00";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function utc(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function format(value: Date) {
  return value.toISOString().slice(0, 10);
}
export function isDate(value: unknown): value is string {
  return typeof value === "string" && DATE.test(value) && format(utc(value)) === value;
}
export function seoulToday(now = new Date()) {
  return format(new Date(now.getTime() + 9 * 3600_000));
}
export function addDays(date: string, days: number) {
  const value = utc(date);
  value.setUTCDate(value.getUTCDate() + days);
  return format(value);
}
// Matches Postgres `date + interval '1 year'` (Feb 29 becomes Feb 28).
export function addYear(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const last = new Date(Date.UTC(y + 1, m, 0)).getUTCDate();
  return format(new Date(Date.UTC(y + 1, m - 1, Math.min(d, last))));
}
export function scheduleHorizon(today: string) {
  return addYear(today);
}
// ISO weekday: Monday = 1 … Sunday = 7.
export function isoWeekday(date: string) {
  return utc(date).getUTCDay() || 7;
}
export function weekStart(date: string) {
  return addDays(date, 1 - isoWeekday(date));
}
export function daysBetween(from: string, to: string) {
  return Math.round((utc(to).getTime() - utc(from).getTime()) / 86400_000);
}
export function seoulDateTime(iso: string) {
  const local = new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}
export function startOfSeoulDay(date: string) {
  return `${date}T00:00:00${SEOUL_OFFSET}`;
}
export function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
export function minutesToTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
export const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;
export function weekdayLabel(date: string) {
  return WEEKDAY_LABELS[isoWeekday(date) - 1];
}
export function shortDate(date: string) {
  return `${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}`;
}
