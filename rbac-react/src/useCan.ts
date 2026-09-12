import { useCallback } from "react";

import { useRbac } from "./context.js";
import { useLatest, useStableParams } from "./deps.js";
import { useAccessCheck } from "./useAccessCheck.js";
import type { AccessState, CheckOptions } from "./types.js";

export interface UseCanOptions extends CheckOptions {
  /** Passed through to `RbacUser.can`; ignored when `params` is non-empty. */
  allowCaching?: boolean;
}

/**
 * Whether the current user holds `permissionName` — directly, or through the
 * hierarchy of roles.
 *
 * ```tsx
 * const { allowed, isLoading } = useCan("updatePost", { params: { post } });
 * ```
 */
export function useCan(permissionName: string, options: UseCanOptions = {}): AccessState {
  const { user, revision } = useRbac();
  const params = useStableParams(options.params);
  const allowCaching = options.allowCaching ?? true;
  const logging = useLatest(options.logging);

  const check = useCallback(
    () => user.can({ permissionName, params, allowCaching, logging: logging.current }),
    // `revision` is unused inside the closure on purpose: it is how `refresh()`
    // forces a new question after the authorization data changed.
    [user, revision, permissionName, params, allowCaching, logging],
  );

  return useAccessCheck(check);
}
