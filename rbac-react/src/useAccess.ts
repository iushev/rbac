import { useCallback } from "react";
import { matchRole } from "@iushev/rbac";

import { useRbac } from "./context.js";
import { useLatest, useStableParams, useStableRoles } from "./deps.js";
import { useAccessCheck } from "./useAccessCheck.js";
import type { AccessState, CheckOptions } from "./types.js";

export interface UseAccessOptions extends CheckOptions {
  /** Set to false to invert the match, turning the role list into a deny list. */
  allow?: boolean;
}

/**
 * Whether the current user matches any of `roles`.
 *
 * Two names are special: `"?"` matches a guest and `"@"` any authenticated
 * user. An empty list matches everyone.
 *
 * ```tsx
 * const { allowed } = useAccess(["admin", "author"]);
 * ```
 */
export function useAccess(roles: readonly string[], options: UseAccessOptions = {}): AccessState {
  const { user, revision } = useRbac();
  const stableRoles = useStableRoles(roles);
  const params = useStableParams(options.params);
  const allow = options.allow ?? true;
  const logging = useLatest(options.logging);

  const check = useCallback(
    () => matchRole({ user, roles: [...stableRoles], allow, params, logging: logging.current }),
    // See the note in `useCan` on why `revision` is a dependency.
    [user, revision, stableRoles, allow, params, logging],
  );

  return useAccessCheck(check);
}
