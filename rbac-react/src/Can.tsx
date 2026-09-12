import type { ReactNode } from "react";

import { useCan, type UseCanOptions } from "./useCan.js";

export interface CanProps extends UseCanOptions {
  /** The permission (or role) the children need. */
  permission: string;
  children?: ReactNode;
  /** Rendered instead of the children when the user does not hold the permission. */
  fallback?: ReactNode;
  /** Rendered while the check runs. Nothing by default. */
  pending?: ReactNode;
}

/**
 * Renders its children only for a user who holds `permission`, and `fallback`
 * — nothing, unless given — for anyone else.
 *
 * ```tsx
 * <Can permission="createPost">
 *   <NewPostButton />
 * </Can>
 *
 * <Can permission="updatePost" params={{ post }} fallback={<p>No access.</p>}>
 *   <EditPostForm post={post} />
 * </Can>
 * ```
 *
 * The check is asynchronous, so `pending` — and not `fallback` — is what the
 * first render shows: a "no access" message must not flash at a user who turns
 * out to have access.
 */
export function Can({
  permission,
  children,
  fallback = null,
  pending = null,
  params,
  allowCaching,
  logging,
}: CanProps) {
  const { allowed, isLoading, error } = useCan(permission, { params, allowCaching, logging });

  // A rejected check is a defect in the authorization data, not a denial — an
  // error boundary has to see it instead of it reading as "no access".
  if (error) {
    throw error;
  }

  if (isLoading) {
    return <>{pending}</>;
  }

  return <>{allowed ? children : fallback}</>;
}
