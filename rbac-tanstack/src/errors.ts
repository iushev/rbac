/**
 * Base for the errors the guards throw.
 *
 * `status` / `statusCode` mirror the `http-errors` shape that `rbac-express`
 * also follows, so an application that runs both adapters reads one thing.
 *
 * These cross the RPC boundary: `rbacSerializationAdapters` puts them back
 * together in the browser, so `instanceof ForbiddenError` holds there too.
 */
export class RbacHttpError extends Error {
  public readonly status: number;
  public readonly statusCode: number;
  /** Marks the message as safe to send to the client. */
  public readonly expose = true;
  /** The item names the guard asked for. */
  public readonly required: readonly string[];

  constructor(status: number, message: string, required: readonly string[] = []) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.statusCode = status;
    this.required = required;
  }
}

/** The call is from a guest and the guard needs an authenticated user. */
export class UnauthorizedError extends RbacHttpError {
  constructor(required: readonly string[] = [], message = "Authentication required.") {
    super(401, message, required);
  }
}

/** The user is authenticated but does not hold what the guard asked for. */
export class ForbiddenError extends RbacHttpError {
  constructor(required: readonly string[] = [], message = "Access denied.") {
    super(403, message, required);
  }
}

export function isRbacHttpError(value: unknown): value is RbacHttpError {
  return value instanceof RbacHttpError;
}

/**
 * Rebuilds the error a guard threw from its serialized form.
 *
 * The status is what picks the class, so the two a guard produces survive the
 * round trip as themselves rather than as a base `RbacHttpError`.
 */
export function reviveRbacHttpError(input: {
  status: number;
  message: string;
  required: readonly string[];
}): RbacHttpError {
  switch (input.status) {
    case 401:
      return new UnauthorizedError(input.required, input.message);
    case 403:
      return new ForbiddenError(input.required, input.message);
    default:
      return new RbacHttpError(input.status, input.message, input.required);
  }
}
