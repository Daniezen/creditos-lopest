/**
 * Monday-first month grid of the compact calendar (`Main.dc.html`): leading
 * blanks for the days of the week before the 1st, then the days, padded with
 * trailing blanks to whole weeks. `null` is a blank cell.
 *
 * Computed in UTC so the server's time zone can never shift a weekday.
 */
export function calendarCells(year: number, month: number): (number | null)[] {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const sundayFirst = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const leading = (sundayFirst + 6) % 7;
  const cells: (number | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"] as const;
export const WEEKDAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"] as const;
