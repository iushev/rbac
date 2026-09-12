import type { Request } from "express";

import type { SessionUser } from "../shared/api.js";
import { userByToken } from "./users.js";

/** `Authorization: Bearer <token>`, the way the browser client sends it. */
export function tokenFromRequest(req: Request): string | null {
  const header = req.get("authorization");
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

/**
 * The single point where authentication meets authorization: `rbacMiddleware`
 * calls this for every request and `rbac` never learns anything else about how
 * the user was identified. Swap the body for passport, a session or a JWT and
 * nothing below it changes.
 */
export function identityFromRequest(req: Request): SessionUser | null {
  return userByToken(tokenFromRequest(req));
}
