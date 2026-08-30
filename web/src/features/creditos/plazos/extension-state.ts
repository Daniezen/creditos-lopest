export interface ExtensionTermState {
  ok: boolean;
  message: string | null;
}

export const initialExtensionTermState: ExtensionTermState = {
  ok: false,
  message: null,
};
