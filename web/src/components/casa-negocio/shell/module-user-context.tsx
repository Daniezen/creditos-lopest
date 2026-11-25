"use client";

import { createContext, useContext } from "react";

import type { ModuleUser } from "./user-avatar";

/**
 * The signed-in user, handed by the module layout to client pieces that show
 * the account (the phone header's avatar) without each page fetching it again.
 * Presentation only: authorization never reads this.
 */
const ModuleUserContext = createContext<ModuleUser | null>(null);

export function ModuleUserProvider({ user, children }: { user: ModuleUser; children: React.ReactNode }) {
  return <ModuleUserContext.Provider value={user}>{children}</ModuleUserContext.Provider>;
}

export function useModuleUser(): ModuleUser | null {
  return useContext(ModuleUserContext);
}
