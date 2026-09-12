/**
 * Base for the errors the guards and the controller hand to `next()`.
 *
 * `status` / `statusCode` mirror the `http-errors` shape, so the common Express
 * error handlers and `res.status(err.status)` patterns work unchanged.
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

/** The request is from a guest and the guard needs an authenticated user. */
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

/** The request body or a path segment is not something the API can act on. */
export class BadRequestError extends RbacHttpError {
  constructor(message: string) {
    super(400, message);
  }
}

/** The named role, permission, rule or assignment does not exist. */
export class NotFoundError extends RbacHttpError {
  constructor(message: string) {
    super(404, message);
  }
}

/** The name is taken, or the relation the request creates is already there. */
export class ConflictError extends RbacHttpError {
  constructor(message: string) {
    super(409, message);
  }
}
