export interface TransferActionState {
  ok: boolean;
  message: string | null;
  /** Per-field validation messages, present only when the input failed its schema. */
  fieldErrors?: Record<string, string>;
}

export const initialTransferActionState: TransferActionState = {
  ok: false,
  message: null,
};
