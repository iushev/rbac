import {
  CheckAccess,
  InMemoryRbacStore,
  RbacUser,
  isPermission,
  isRole,
  type Item,
  type Logger,
  type Permission,
  type Role,
  type RuleRegistry,
} from "@iushev/rbac";

import type { RbacIdentity, RbacSessionState } from "./types.js";

export interface AccessCheckerOptions {
  /**
   * The rule implementations. The same registry the server checks with — a
   * store keeps only a rule's name, so both sides register the code, and that
   * is what makes the browser's answer about a rule-bearing permission the
   * same as the guard's.
   */
  rules?: RuleRegistry;
  /** Items every user holds without an assignment. */
  defaultRoles?: string[];
  logging?: false | Logger;
}

/** `store.assign` takes a role or a permission; `getItem` hands back an `Item`. */
function asAssignable(item: Item): Role | Permission | null {
  if (isRole(item)) {
    return item;
  }
  return isPermission(item) ? item : null;
}

/**
 * Builds the checker the browser answers its own questions with.
 *
 * The snapshot is the graph as the server sees it, minus the assignments, so
 * the current user's are replayed into the store here. What comes back is
 * `CheckAccess` — the read-only half of the core. A client asks questions; the
 * graph is changed through guarded server functions or not at all.
 */
export async function buildAccessChecker(
  session: RbacSessionState,
  options: AccessCheckerOptions = {},
): Promise<CheckAccess> {
  const store = new InMemoryRbacStore(session.snapshot);

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
    rules: options.rules,
    defaultRoles: options.defaultRoles,
    logging: options.logging,
  });
}

/**
 * One checker per session object, built at most once.
 *
 * The session is the key, and that is the whole contract: a route that reloads
 * hands out a new session, and a new session has to produce a new checker —
 * that is how a changed assignment reaches the UI. Everything else — a
 * re-render, a second route asking the same question — gets the promise that
 * is already there.
 *
 * The stability matters beyond saving work. `use()` re-runs the render that
 * suspended on it, so a fresh promise per render would suspend forever.
 *
 * `options` are read when a session's checker is first built; pass a registry
 * that lives as long as the application, not one built per render.
 */
const checkers = new WeakMap<RbacSessionState, Promise<CheckAccess>>();

export function accessCheckerFor(
  session: RbacSessionState,
  options: AccessCheckerOptions = {},
): Promise<CheckAccess> {
  let checker = checkers.get(session);
  if (checker === undefined) {
    checker = buildAccessChecker(session, options);
    checkers.set(session, checker);
  }
  return checker;
}

/**
 * The session's checker, bound to the identity it belongs to.
 *
 * Cached the same way, so a route guard in `beforeLoad` and the components
 * below it share one user — and therefore one access cache.
 */
const users = new WeakMap<RbacSessionState, Promise<RbacUser<RbacIdentity>>>();

export function rbacUserFor(
  session: RbacSessionState,
  options: AccessCheckerOptions = {},
): Promise<RbacUser<RbacIdentity>> {
  let user = users.get(session);
  if (user === undefined) {
    user = accessCheckerFor(session, options).then(
      (checker) => new RbacUser<RbacIdentity>(checker, session.user),
    );
    users.set(session, user);
  }
  return user;
}
