import { useCallback, useMemo, useState, type ReactNode } from "react";
import { RbacUser, type CheckAccess } from "@iushev/rbac";

import { RbacContext, type RbacContextValue } from "./context.js";
import type { RbacIdentity } from "./types.js";

interface CommonProps {
  children?: ReactNode;
}

export interface UserProviderProps extends CommonProps {
  /** An `RbacUser` the application builds and owns itself. */
  user: RbacUser<RbacIdentity>;
  accessChecker?: never;
  identity?: never;
}

export interface IdentityProviderProps extends CommonProps {
  user?: never;
  /**
   * The access checker holding the authorization data. `RbacManager` extends
   * `CheckAccess`, so a manager can be passed directly.
   */
  accessChecker: CheckAccess;
  /** The identity to act as, or `null` for a guest. */
  identity?: RbacIdentity | null;
}

export type RbacProviderProps = UserProviderProps | IdentityProviderProps;

/**
 * Makes one `RbacUser` available to every hook and component below it.
 *
 * Usually the provider builds the user itself, from an access checker and the
 * identity the application's authentication layer produced:
 *
 * ```tsx
 * <RbacProvider accessChecker={checkAccess} identity={session.user ?? null}>
 *   <App />
 * </RbacProvider>
 * ```
 *
 * A new `identity` builds a new user, which is what leaves the access cache of
 * the previous one behind. When the application passes a `user` of its own
 * instead, changing that user's identity is invisible to React: call
 * {@link useRbac}'s `refresh` afterwards.
 */
export function RbacProvider({
  user: providedUser,
  accessChecker,
  identity = null,
  children,
}: RbacProviderProps) {
  const [revision, setRevision] = useState(0);

  const user = useMemo(() => {
    if (providedUser) {
      return providedUser;
    }
    if (!accessChecker) {
      throw new Error("<RbacProvider> needs either a `user` or an `accessChecker`.");
    }
    return new RbacUser<RbacIdentity>(accessChecker, identity);
  }, [providedUser, accessChecker, identity]);

  const refresh = useCallback(() => {
    user.clearAccessCache();
    setRevision((current) => current + 1);
  }, [user]);

  const value = useMemo<RbacContextValue>(
    () => ({ user, revision, refresh }),
    [user, revision, refresh],
  );

  return <RbacContext.Provider value={value}>{children}</RbacContext.Provider>;
}
