import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { rbacSerializationAdapters } from "@iushev/rbac-tanstack";

/**
 * Server functions are same-origin RPC endpoints that ride on the session
 * cookie, so a page on another site could call them as the signed-in user.
 * The guards would let it through — the caller *is* the user, and that is
 * exactly the point of CSRF. This middleware refuses the request before any of
 * that, on `Sec-Fetch-Site` / `Origin` / `Referer`.
 *
 * The filter keeps it to server functions. A document request is a navigation,
 * and arriving from another site is what a link is for.
 */
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

/**
 * Two things cross the RPC boundary that Start cannot serialize on its own: a
 * guard's refusal, which would arrive as a bare `Error` and lose the
 * difference between 401 and 403, and the graph, whose `Rule.data` is typed
 * `unknown`. Both adapters come from `rbac-tanstack`.
 */
export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
  serializationAdapters: [...rbacSerializationAdapters],
}));
