import { createContext, useContext } from "react";
import type { RbacUser } from "@iushev/rbac";

import type { RbacIdentity } from "./types.js";

export interface RbacContextValue {
  user: RbacUser<RbacIdentity>;
  /** Bumped by {@link RbacContextValue.refresh}; every mounted check re-runs when it changes. */
  revision: number;
  /** Drops the access cache and re-runs every mounted check. */
  refresh: () => void;
}

export const RbacContext = createContext<RbacContextValue | null>(null);

/** The provider's user, together with the handle to re-run every check. */
export function useRbac(): RbacContextValue {
  const value = useContext(RbacContext);
  if (value === null) {
    throw new Error("useRbac() must be called inside <RbacProvider>.");
  }
  return value;
}

/**
 * The `RbacUser` of the current provider. The same object the checks run
 * against, so `user.identity` is where the application reads its own user from.
 */
export function useRbacUser(): RbacUser<RbacIdentity> {
  return useRbac().user;
}
