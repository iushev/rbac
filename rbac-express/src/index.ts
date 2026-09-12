export { rbacMiddleware } from "./middleware.js";
export type { RbacMiddlewareOptions } from "./middleware.js";

export { can, access } from "./guards.js";
export type { AccessGuardOptions } from "./guards.js";

export { rbacController } from "./controller.js";
export type { RbacControllerOptions } from "./controller.js";

export {
  RbacHttpError,
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
  NotFoundError,
  ConflictError,
} from "./errors.js";

export type { GuardOptions, ParamsResolver, DenialContext, OnDenied } from "./types.js";
