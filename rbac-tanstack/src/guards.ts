import { createMiddleware } from "@tanstack/react-start";
import { matchRole, type Logger, type RbacUser, type RuleParams } from "@iushev/rbac";

import { ForbiddenError, UnauthorizedError, type RbacHttpError } from "./errors.js";
import type {
  GuardInput,
  GuardOptions,
  ParamsResolver,
  RbacContext,
  RbacIdentity,
} from "./types.js";

/**
 * A guest is refused with 401 rather than 403: the call may well succeed once
 * it carries an identity, and that is the distinction the two statuses make.
 * Nothing else in an application is allowed to invent this difference.
 */
function denialFor(user: RbacUser<RbacIdentity>, required: readonly string[]): RbacHttpError {
  return user.isGuest ? new UnauthorizedError(required) : new ForbiddenError(required);
}

export interface CheckOptions {
  /** Passed through to `RbacUser.can`; ignored when `params` is non-empty. */
  allowCaching?: boolean;
  logging?: Logger;
}

export interface RoleCheckOptions extends CheckOptions {
  /** Set to false to invert the match, turning the role list into a deny list. */
  allow?: boolean;
  params?: RuleParams;
}

/**
 * Refuses the call unless the user holds `permissionName`.
 *
 * For a check whose rule needs the resource, load it first and pass it in —
 * the guard has to judge the post, not the id the caller sent:
 *
 * ```ts
 * const post = loadPost(data.id);
 * await requireCan(context.rbacUser, "updatePost", { post });
 * ```
 */
export async function requireCan(
  user: RbacUser<RbacIdentity>,
  permissionName: string,
  params: RuleParams = {},
  options: CheckOptions = {},
): Promise<void> {
  const allowed = await user.can({
    permissionName,
    params,
    allowCaching: options.allowCaching ?? true,
    logging: options.logging,
  });

  if (!allowed) {
    throw denialFor(user, [permissionName]);
  }
}

/**
 * Refuses the call unless the user matches any of `roles`.
 *
 * Two names are special: `"?"` matches a guest and `"@"` any authenticated
 * user. An empty list matches everyone.
 */
export async function requireRole(
  user: RbacUser<RbacIdentity>,
  roles: readonly string[],
  options: RoleCheckOptions = {},
): Promise<void> {
  const required = [...roles];
  const matched = await matchRole({
    user,
    roles: required,
    allow: options.allow ?? true,
    params: options.params ?? {},
    logging: options.logging,
  });

  if (!matched) {
    throw denialFor(user, required);
  }
}

/** The user {@link rbacMiddleware} left in the context, or a readable failure. */
function requireRbacUser(context: unknown): RbacUser<RbacIdentity> {
  const user = (context as Partial<RbacContext> | undefined)?.rbacUser;
  if (!user) {
    throw new Error(
      "context.rbacUser is missing. Put rbacMiddleware() before this guard in the middleware array.",
    );
  }
  return user;
}

async function resolveParams(
  resolver: ParamsResolver | undefined,
  input: GuardInput,
): Promise<RuleParams> {
  if (resolver === undefined) {
    return {};
  }
  return typeof resolver === "function" ? await resolver(input) : resolver;
}

/**
 * Guards a server function with `permissionName`.
 *
 * ```ts
 * export const createPost = createServerFn({ method: "POST" })
 *   .middleware([rbac, can("createPost")])
 *   .handler(({ context }) => posts.create(context.rbacUser.username));
 * ```
 *
 * The application's own `rbacMiddleware()` has to come first in that array —
 * it is what puts the user in the context, and this guard reads it from there.
 *
 * A rule's params can be derived from the call's validated input, which covers
 * the checks that need no lookup:
 *
 * ```ts
 * can("updatePost", { params: ({ data }) => ({ post: data.post }) })
 * ```
 *
 * When the resource has to be loaded first, the check belongs in the handler
 * instead — see {@link requireCan}.
 */
export function can(permissionName: string, options: GuardOptions = {}) {
  return createMiddleware({ type: "function" }).server(async ({ next, data, context }) => {
    const user = requireRbacUser(context);
    const params = await resolveParams(options.params, { data, context });
    await requireCan(user, permissionName, params, options);
    return next();
  });
}

/**
 * Guards a server function with a list of roles, any one of which is enough.
 *
 * ```ts
 * export const listUsers = createServerFn({ method: "GET" })
 *   .middleware([rbac, access(["admin"])])
 *   .handler(() => users.all());
 * ```
 *
 * "This screen is for these roles" is what this is for; a single permission is
 * usually better said with {@link can}.
 */
export function access(roles: readonly string[], options: GuardOptions & { allow?: boolean } = {}) {
  const required = [...roles];
  return createMiddleware({ type: "function" }).server(async ({ next, data, context }) => {
    const user = requireRbacUser(context);
    const params = await resolveParams(options.params, { data, context });
    await requireRole(user, required, { ...options, params });
    return next();
  });
}
