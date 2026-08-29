const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function getKstToday(now = new Date()) {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return formatIsoDate(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());
}

export function formatIsoDate(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return { year, monthIndex: month - 1, day };
}

export function addDays(value: string, amount: number) {
  const { year, monthIndex, day } = parseIsoDate(value);
  const date = new Date(Date.UTC(year, monthIndex, day + amount));
  return formatIsoDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function getDaysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function getScheduledDay(year: number, monthIndex: number, billingDay: number) {
  return Math.min(billingDay, getDaysInMonth(year, monthIndex));
}

export function getScheduledDate(year: number, monthIndex: number, billingDay: number) {
  return formatIsoDate(year, monthIndex, getScheduledDay(year, monthIndex, billingDay));
}

export function getMonthKey(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

export function moveMonth(year: number, monthIndex: number, amount: number) {
  const date = new Date(Date.UTC(year, monthIndex + amount, 1));
  return { year: date.getUTCFullYear(), monthIndex: date.getUTCMonth() };
}

export function getCalendarCells(year: number, monthIndex: number) {
  const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const days = getDaysInMonth(year, monthIndex);
  const cells: Array<number | null> = Array.from({ length: firstWeekday }, () => null);

  for (let day = 1; day <= days; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}
