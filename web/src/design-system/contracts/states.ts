export const stateContract = {
  semantic: ["neutral", "info", "success", "warning", "danger"] as const,
  async: ["idle", "loading", "success", "error"] as const,
  recoverableErrorPreserves: [
    "field-values",
    "selected-files",
    "checks",
    "valid-progress",
  ] as const,
} as const;
