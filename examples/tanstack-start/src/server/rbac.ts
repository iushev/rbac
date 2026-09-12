import { createServerOnlyFn } from "@tanstack/react-start";
import { rbacMiddleware } from "@iushev/rbac-tanstack";

import { getRbac } from "./graph.js";
import { getIdentity } from "./session.js";

/**
 * The application's half of the guard: which graph to check against, and who
 * is asking. Everything else — the `RbacUser` in the context, the refusal and
 * its status — is `rbac-tanstack`.
 *
 * Both callbacks are wrapped in `createServerOnlyFn`, and that is not
 * decoration. This module is imported by the browser as well, because the
 * server functions below it have a client half; the compiler replaces the body
 * of a server-only function with a stub there, and with it the imports of the
 * session and the graph. A plain arrow would keep them, and `node:crypto`
 * would end up in the browser bundle.
 */
export const rbac = rbacMiddleware({
  accessChecker: createServerOnlyFn(async () => (await getRbac()).manager),
  getIdentity: createServerOnlyFn(() => getIdentity()),
});
