import { createMiddleware } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { RbacUser, type CheckAccess } from "@iushev/rbac";

import { isRbacHttpError } from "./errors.js";
import type { RbacIdentity } from "./types.js";

export interface RbacMiddlewareOptions {
  /**
   * The access checker holding the authorization data, or a function that
   * produces it. `RbacManager` extends `CheckAccess`, so a manager can be
   * passed directly; a function is what an application whose graph is built
   * asynchronously — from a database, usually — hands over instead.
   */
  accessChecker: CheckAccess | (() => CheckAccess | Promise<CheckAccess>);
  /**
   * The identity the call acts as, or `null` for a guest. This is where an
   * existing authentication layer plugs in: read the cookie, the session or
   * the `Authorization` header here and return your own user.
   */
  getIdentity: () => RbacIdentity | null | Promise<RbacIdentity | null>;
  /**
   * Whether a refused call answers with the guard's status — 401 or 403
   * instead of a bare 200 carrying an error. On by default.
   *
   * It applies to server-function calls. A request for a *document* that a
   * loader refuses is answered 500 by the router, whatever is set here.
   */
  setStatus?: boolean;
}

/**
 * Puts an `RbacUser` in the context of every server function it is mounted on,
 * guests included, so the guards and the handler share one access cache per
 * call.
 *
 * ```ts
 * export const rbac = rbacMiddleware({
 *   accessChecker: createServerOnlyFn(() => getManager()),
 *   getIdentity: createServerOnlyFn(() => readSession()),
 * });
 * ```
 *
 * Wrap both callbacks in `createServerOnlyFn`. They reach for the database and
 * the request, and the module that mounts the middleware is imported by the
 * browser too — for the client half of the server function. The compiler drops
 * the body of a server-only function from the client bundle; a plain arrow it
 * would keep, along with everything it imports.
 *
 * It grants nothing on its own: a server function without a guard is as open
 * as an Express route without one.
 */
export function rbacMiddleware({
  accessChecker,
  getIdentity,
  setStatus = true,
}: RbacMiddlewareOptions) {
  return createMiddleware({ type: "function" }).server(async ({ next }) => {
    const checker = typeof accessChecker === "function" ? await accessChecker() : accessChecker;
    const rbacUser = new RbacUser<RbacIdentity>(checker, await getIdentity());

    try {
      return await next({ context: { rbacUser } });
    } catch (error) {
      // The single place a refusal becomes an HTTP status, the way an Express
      // error handler does it. Everything else keeps the status it would have
      // had: a broken rule is a 500, not a 403.
      if (setStatus && isRbacHttpError(error)) {
        setResponseStatus(error.status);
      }
      throw error;
    }
  });
}
