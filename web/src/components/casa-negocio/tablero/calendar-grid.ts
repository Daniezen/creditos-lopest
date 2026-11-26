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

/** Spoken name of each dot kind, singular and plural (colour is never the only signal). */
const KIND_WORDS = {
  cobro: ["cobro", "cobros"],
  casa: ["movimiento de la casa", "movimientos de la casa"],
  falta: ["pendiente", "pendientes"],
  ahorro: ["paso al ahorro", "pasos al ahorro"],
} as const;

export type CalendarKind = keyof typeof KIND_WORDS;

/**
 * Accessible name of a day: its date and what its dots mean, in words
 * («20 de noviembre: 1 cobro, 1 movimiento de la casa, 1 pendiente»).
 */
export function calendarDayLabel(date: string, kinds: readonly CalendarKind[]): string {
  if (kinds.length === 0) return date;
  const counts = new Map<CalendarKind, number>();
  for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  const parts = (Object.keys(KIND_WORDS) as CalendarKind[])
    .filter((kind) => counts.has(kind))
    .map((kind) => {
      const n = counts.get(kind)!;
      return `${n} ${KIND_WORDS[kind][n === 1 ? 0 : 1]}`;
    });
  return `${date}: ${parts.join(", ")}`;
}

/**
 * Arrow-key movement between the days that have something (the only ones
 * that are buttons): left/right go to the previous/next such day, up/down to
 * the nearest one a week before/after (or the first/last if none is that
 * far), Home/End to the first/last. Returns null for other keys or when there
 * is nowhere to go, so the key keeps its default behaviour.
 */
export function neighbourDay(enabled: readonly number[], day: number, key: string): number | null {
  const days = [...enabled].sort((a, b) => a - b);
  if (days.length === 0) return null;
  const pick = (value: number | undefined) => (value === undefined || value === day ? null : value);
  switch (key) {
    case "ArrowRight":
      return pick(days.find((d) => d > day));
    case "ArrowLeft":
      return pick([...days].reverse().find((d) => d < day));
    case "ArrowDown":
      return pick(days.find((d) => d >= day + 7) ?? days.filter((d) => d > day).at(-1));
    case "ArrowUp":
      return pick([...days].reverse().find((d) => d <= day - 7) ?? days.find((d) => d < day));
    case "Home":
      return pick(days[0]);
    case "End":
      return pick(days.at(-1));
    default:
      return null;
  }
}
