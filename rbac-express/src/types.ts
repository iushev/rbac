import type { Identity, Logger, RbacUser, RuleParams } from "@iushev/rbac";
import type { NextFunction, Request, Response } from "express";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    /**
     * The identity shape `req.rbacUser` carries. Augment it in the application
     * to get the extra fields of your own user typed:
     *
     * ```ts
     * declare global {
     *   namespace Express {
     *     interface RbacIdentity {
     *       id: number;
     *     }
     *   }
     * }
     * ```
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RbacIdentity extends Identity {}

    interface Request {
      /** Set by the {@link rbac} middleware for every request, guests included. */
      rbacUser: RbacUser<RbacIdentity>;
    }
  }
}

/** Rule params for a guard: a fixed object, or derived from the request. */
export type ParamsResolver = RuleParams | ((req: Request) => RuleParams | Promise<RuleParams>);

/** Everything known about a refused request. */
export interface DenialContext {
  req: Request;
  user: RbacUser<Express.RbacIdentity>;
  /** The item names the guard asked for. */
  required: readonly string[];
  /** The params the check ran with. */
  params: RuleParams;
  /** The error the default handler would have passed to `next()`. */
  error: Error;
}

/**
 * Replaces the default denial behaviour. Must end the request or call `next`;
 * anything it throws or rejects with is forwarded to `next`.
 */
export type OnDenied = (
  context: DenialContext,
  res: Response,
  next: NextFunction,
) => void | Promise<void>;

/** Options shared by every guard. */
export interface GuardOptions {
  params?: ParamsResolver;
  /** Passed through to `RbacUser.can`; ignored when `params` is non-empty. */
  allowCaching?: boolean;
  logging?: Logger;
  onDenied?: OnDenied;
}
