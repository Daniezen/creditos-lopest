export const componentContract = {
  actions: ["primary", "secondary", "tertiary", "destructive"] as const,
  surfaces: ["canvas", "primary", "subtle", "elevated"] as const,
  densities: ["compact", "comfortable"] as const,
  states: ["default", "hover", "focus", "disabled", "loading", "error"] as const,
} as const;

export type ActionVariant = (typeof componentContract.actions)[number];
export type SurfaceVariant = (typeof componentContract.surfaces)[number];
export type Density = (typeof componentContract.densities)[number];
