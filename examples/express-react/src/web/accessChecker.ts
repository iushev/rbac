import {
  CheckAccess,
  InMemoryRbacStore,
  isPermission,
  isRole,
  type Item,
  type Permission,
  type RbacSnapshot,
  type Role,
} from "@iushev/rbac";

import type { SessionResponse } from "../shared/api.js";
import { DEFAULT_ROLES, createRuleRegistry } from "../shared/rbac.js";

/** `store.assign` takes a role or a permission; `getItem` hands back an `Item`. */
function asAssignable(item: Item): Role | Permission | null {
  if (isRole(item)) {
    return item;
  }
  return isPermission(item) ? item : null;
}

/**
 * Builds the access checker the UI runs its checks against.
 *
 * The snapshot is the graph as the server sees it, minus the assignments — a
 * client only ever needs those of the current user, so they are replayed into
 * the store here. The registry is the shared one, which is what makes the
 * browser's answer about `updatePost` identical to the guard's.
 *
 * Note what is *not* here: `RbacManager`. The client gets `CheckAccess`, the
 * read-only half — it answers questions, it does not change the graph.
 */
export async function buildAccessChecker(
  snapshot: RbacSnapshot,
  session: SessionResponse,
): Promise<CheckAccess> {
  const store = new InMemoryRbacStore(snapshot);

  if (session.user !== null) {
    for (const name of session.assignments) {
      const item = await store.getItem(name);
      const assignable = item === null ? null : asAssignable(item);
      if (assignable !== null) {
        await store.assign(assignable, session.user.username);
      }
    }
  }

  return new CheckAccess({
    store,
    rules: createRuleRegistry(),
    defaultRoles: DEFAULT_ROLES,
  });
}
