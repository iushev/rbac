import { toSnapshot, type RbacManagerStore } from "@iushev/rbac";

import type { RbacIdentity, RbacSessionState } from "./types.js";

/**
 * Packs what the browser needs to answer access questions on its own: the
 * graph, who the caller is, and what is assigned to them.
 *
 * Meant for the one unguarded server function every application of this shape
 * has — the browser cannot be told it is a guest without being told something:
 *
 * ```ts
 * export const getSession = createServerFn({ method: "GET" })
 *   .middleware([rbac])
 *   .handler(({ context }) => toSessionState(store, context.rbacUser.identity));
 * ```
 *
 * The graph is not a secret — it is the same one every user's UI reasons
 * about. The assignments are the current user's only, which is why a snapshot
 * carries none of its own.
 */
export async function toSessionState(
  store: RbacManagerStore,
  user: RbacIdentity | null,
): Promise<RbacSessionState> {
  const snapshot = await toSnapshot(store);

  if (user === null) {
    return { user: null, assignments: [], snapshot };
  }

  const assignments = await store.getAssignments(user.username);
  return { user, assignments: [...assignments.keys()], snapshot };
}
