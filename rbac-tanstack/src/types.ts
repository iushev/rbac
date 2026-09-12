import type { Identity, Logger, RbacSnapshot, RbacUser, RuleParams } from "@iushev/rbac";

/**
 * The identity a server function acts as. Augment it in the application to get
 * the extra fields of your own user typed on `context.rbacUser.identity`:
 *
 * ```ts
 * declare module "@iushev/rbac-tanstack" {
 *   interface RbacIdentity {
 *     displayName: string;
 *   }
 * }
 * ```
 *
 * `rbac-react` carries an interface of the same name for the browser side; an
 * application that uses both augments both, with the same fields.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RbacIdentity extends Identity {}

/** What {@link rbacMiddleware} puts in the context of every server function. */
export interface RbacContext {
  rbacUser: RbacUser<RbacIdentity>;
}

/** What a guard middleware is given to derive its rule params from. */
export interface GuardInput {
  /** The validated input of the server function the guard is mounted on. */
  data: unknown;
  /** The context the middlewares before it produced. */
  context: unknown;
}

/** Rule params for a guard: a fixed object, or derived from the call. */
export type ParamsResolver = RuleParams | ((input: GuardInput) => RuleParams | Promise<RuleParams>);

/** Options shared by every guard. */
export interface GuardOptions {
  params?: ParamsResolver;
  /** Passed through to `RbacUser.can`; ignored when `params` is non-empty. */
  allowCaching?: boolean;
  logging?: Logger;
}

/**
 * Everything the browser needs to answer access questions on its own.
 *
 * A snapshot is the graph without the assignments — a client only ever needs
 * those of the current user — so they travel beside it. Built on the server by
 * {@link toSessionState} and turned back into a `CheckAccess` by
 * {@link buildAccessChecker}.
 */
export interface RbacSessionState {
  user: RbacIdentity | null;
  /** The direct assignments of `user`, by item name. */
  assignments: string[];
  snapshot: RbacSnapshot;
}
