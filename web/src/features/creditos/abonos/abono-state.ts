/**
 * State contract for extraordinary principal prepayment (abono a capital) form.
 */
export interface AbonoFormState {
  ok: boolean;
  message: string | null;
  /** Per-field validation messages, present only when the input failed its schema. */
  fieldErrors?: Record<string, string>;
}

export const initialAbonoFormState: AbonoFormState = {
  ok: false,
  message: null,
};
