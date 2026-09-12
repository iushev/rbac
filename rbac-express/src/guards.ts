import type { NextFunction, Request, RequestHandler, Response } from "express";
import { matchRole, type RuleParams } from "@iushev/rbac";

import { ForbiddenError, UnauthorizedError } from "./errors.js";
import type { DenialContext, GuardOptions, ParamsResolver } from "./types.js";

export interface AccessGuardOptions extends GuardOptions {
  /** Set to false to invert the match, turning the role list into a deny list. */
  allow?: boolean;
}

function requireRbacUser(req: Request): Request["rbacUser"] {
  const user = req.rbacUser as Request["rbacUser"] | undefined;
  if (!user) {
    throw new Error(
      "req.rbacUser is missing. Mount rbacMiddleware() before any route a guard protects.",
    );
  }
  return user;
}

async function resolveParams(resolver: ParamsResolver | undefined, req: Request) {
  if (resolver === undefined) {
    return {};
  }
  return typeof resolver === "function" ? await resolver(req) : resolver;
}

/**
 * A guest is answered with 401 rather than 403: the request may well succeed
 * once it carries an identity, and that is the distinction the status codes make.
 */
async function deny(
  context: Omit<DenialContext, "error">,
  res: Response,
  next: NextFunction,
  onDenied: GuardOptions["onDenied"],
): Promise<void> {
  const required = context.required;
  const error = context.user.isGuest
    ? new UnauthorizedError(required)
    : new ForbiddenError(required);

  if (onDenied) {
    await onDenied({ ...context, error }, res, next);
    return;
  }

  next(error);
}

function guard(
  required: readonly string[],
  options: GuardOptions,
  check: (user: Request["rbacUser"], params: RuleParams) => Promise<boolean>,
): RequestHandler {
  return (req, res, next) => {
    void (async () => {
      const user = requireRbacUser(req);
      const params = await resolveParams(options.params, req);

      if (await check(user, params)) {
        next();
        return;
      }

      await deny({ req, user, required, params }, res, next, options.onDenied);
    })().catch(next);
  };
}

/**
 * Lets the request through when the user holds `permissionName`, otherwise
 * hands a {@link ForbiddenError} (or {@link UnauthorizedError} for a guest) to
 * `next()`.
 *
 * Rules receive `params`, which is where a resource loaded earlier in the chain
 * goes:
 *
 * ```ts
 * router.put("/posts/:id", loadPost, can("updatePost", { params: (req) => ({ post: req.post }) }));
 * ```
 */
export function can(permissionName: string, options: GuardOptions = {}): RequestHandler {
  return guard([permissionName], options, (user, params) =>
    user.can({
      permissionName,
      params,
      allowCaching: options.allowCaching ?? true,
      logging: options.logging,
    }),
  );
}

/**
 * Lets the request through when the user matches any of `roles`.
 *
 * Two names are special: `"?"` matches a guest and `"@"` any authenticated
 * user. An empty list matches everyone.
 *
 * ```ts
 * router.use("/admin", access(["admin"]));
 * ```
 */
export function access(roles: string[], options: AccessGuardOptions = {}): RequestHandler {
  const required = [...roles];
  return guard(required, options, (user, params) =>
    matchRole({
      user,
      roles: required,
      allow: options.allow ?? true,
      params,
      logging: options.logging,
    }),
  );
}
