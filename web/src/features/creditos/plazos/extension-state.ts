export interface ExtensionTermState {
  ok: boolean;
  message: string | null;
  /** Per-field validation messages, present only when the input failed its schema. */
  fieldErrors?: Record<string, string>;
}

export const initialExtensionTermState: ExtensionTermState = {
  ok: false,
  message: null,
};
