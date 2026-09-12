import type { Request, RequestHandler } from "express";
import type { CheckAccess } from "@iushev/rbac";
import { RbacUser } from "@iushev/rbac";

export interface RbacMiddlewareOptions {
  /**
   * The access checker holding the authorization data. `RbacManager` extends
   * `CheckAccess`, so a manager can be passed directly.
   */
  accessChecker: CheckAccess;
  /**
   * Maps a request to the identity it acts as, or `null` for a guest. This is
   * where an existing authentication layer plugs in — typically by adapting
   * whatever `req.user` / the session already holds.
   */
  getIdentity: (req: Request) => Express.RbacIdentity | null | Promise<Express.RbacIdentity | null>;
}

/**
 * Attaches `req.rbacUser` to every request, guests included, so the guards and
 * the route handlers share one access-cache per request.
 *
 * Mount it once, above any route a guard protects:
 *
 * ```ts
 * app.use(rbacMiddleware({ accessChecker: manager, getIdentity: (req) => req.user ?? null }));
 * ```
 */
export function rbacMiddleware({
  accessChecker,
  getIdentity,
}: RbacMiddlewareOptions): RequestHandler {
  return (req, _res, next) => {
    void (async () => {
      const identity = await getIdentity(req);
      req.rbacUser = new RbacUser(accessChecker, identity);
      next();
    })().catch(next);
  };
}
