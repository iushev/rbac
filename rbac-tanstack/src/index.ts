export { rbacMiddleware } from "./middleware.js";
export type { RbacMiddlewareOptions } from "./middleware.js";

export { can, access, requireCan, requireRole } from "./guards.js";
export type { CheckOptions, RoleCheckOptions } from "./guards.js";

export {
  RbacHttpError,
  UnauthorizedError,
  ForbiddenError,
  isRbacHttpError,
  reviveRbacHttpError,
} from "./errors.js";

export {
  rbacSerializationAdapters,
  rbacErrorSerializationAdapter,
  rbacSnapshotSerializationAdapter,
} from "./serialization.js";

export { toSessionState } from "./session.js";

export { buildAccessChecker, accessCheckerFor, rbacUserFor } from "./accessChecker.js";
export type { AccessCheckerOptions } from "./accessChecker.js";

export { RbacSession } from "./RbacSession.js";
export type { RbacSessionProps } from "./RbacSession.js";

export type {
  RbacIdentity,
  RbacContext,
  RbacSessionState,
  GuardInput,
  GuardOptions,
  ParamsResolver,
} from "./types.js";
