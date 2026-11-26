import { cnStateRecipes, cnTableroRecipes as r } from "@/design-system/recipes/casa-negocio";

import type {
  AccountBalance,
  Envelope,
  EquationRow,
  MonthCalendarData,
  MoneyPathData,
  NextActionData,
  StreetData,
} from "../types";
import { Envelopes } from "./envelopes";
import { MonthCalendar } from "./month-calendar";
import { MonthEquations } from "./month-equations";
import { MoneyPath } from "./money-path";
import { NextAction } from "./next-action";
import { OnTheStreet } from "./on-the-street";
import { WhereMoney } from "./where-money";

export interface TableroData {
  /** Set when nothing moved in the month: the money path shows this instead of empty bars. */
  quietMonth?: string;
  next?: NextActionData;
  moneyPath: MoneyPathData;
  calendar: MonthCalendarData;
  equations: EquationRow[];
  money: { total: number; accounts: AccountBalance[] };
  street: StreetData;
  envelopes: Envelope[];
  envelopeNearShare?: number;
}

/** «Por dónde pasó la plata» of a month without movements: the card keeps its place, quiet. */
function QuietMonth({ text }: { text: string }) {
  return (
    <section aria-labelledby="cn-flujo" className={[r.card, r.path].join(" ")}>
      <h2 id="cn-flujo" className={r.pathTitle}>
        Por dónde pasó la plata
      </h2>
      <p className={cnStateRecipes.quiet}>{text}</p>
    </section>
  );
}

/**
 * The Tablero tab (`Main.dc.html`), composed from its presentational pieces in
 * the canvas order: money path beside the calendar, the month's equations,
 * where the money is beside what is on the street, and the envelopes.
 */
export function Tablero({ data, readOnly, calendarOpenDay }: { data: TableroData; readOnly: boolean; calendarOpenDay?: number | null }) {
  return (
    <>
      {data.next && !readOnly ? <NextAction data={data.next} /> : null}
      <div className={r.row}>
        {data.quietMonth ? <QuietMonth text={data.quietMonth} /> : <MoneyPath data={data.moneyPath} />}
        <MonthCalendar data={data.calendar} readOnly={readOnly} defaultOpenDay={calendarOpenDay} />
      </div>
      <MonthEquations rows={data.equations} />
      <div className={r.row}>
        <WhereMoney total={data.money.total} accounts={data.money.accounts} />
        <OnTheStreet data={data.street} />
      </div>
      <Envelopes envelopes={data.envelopes} nearShare={data.envelopeNearShare} />
    </>
  );
}
