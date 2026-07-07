export interface TransferActionState {
  ok: boolean;
  message: string | null;
}

export const initialTransferActionState: TransferActionState = {
  ok: false,
  message: null,
};
