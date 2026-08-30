/**
 * State contract for extraordinary principal prepayment (abono a capital) form.
 */
export interface AbonoFormState {
  ok: boolean;
  message: string | null;
}

export const initialAbonoFormState: AbonoFormState = {
  ok: false,
  message: null,
};
