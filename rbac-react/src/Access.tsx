import type { ReactNode } from "react";

import { useAccess, type UseAccessOptions } from "./useAccess.js";

export interface AccessProps extends UseAccessOptions {
  /** The role or permission names, any one of which is enough. */
  roles: readonly string[];
  children?: ReactNode;
  /** Rendered instead of the children when no role matches. */
  fallback?: ReactNode;
  /** Rendered while the check runs. Nothing by default. */
  pending?: ReactNode;
}

/**
 * Renders its children for a user who matches any of `roles`, and `fallback`
 * — nothing, unless given — for anyone else.
 *
 * Two names are special: `"?"` matches a guest and `"@"` any authenticated
 * user. With `allow={false}` the list becomes a deny list.
 *
 * ```tsx
 * <Access roles={["admin"]} fallback={<p>Administrators only.</p>}>
 *   <AdminPanel />
 * </Access>
 *
 * <Access roles={["?"]}>
 *   <LoginLink />
 * </Access>
 * ```
 */
export function Access({
  roles,
  children,
  fallback = null,
  pending = null,
  allow,
  params,
  logging,
}: AccessProps) {
  const { allowed, isLoading, error } = useAccess(roles, { allow, params, logging });

  // See the note in `Can`: a rejected check is not a denial.
  if (error) {
    throw error;
  }

  if (isLoading) {
    return <>{pending}</>;
  }

  return <>{allowed ? children : fallback}</>;
}
