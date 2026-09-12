import type { ErrorRequestHandler, RequestHandler } from "express";
import { UnknownRuleError } from "@iushev/rbac";
import { NotFoundError, RbacHttpError } from "@iushev/rbac-express";

import type { ApiErrorBody } from "../shared/api.js";

export const apiNotFound: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`No route for ${req.method} ${req.originalUrl}.`));
};

/**
 * The guards hand their refusals to `next()` instead of answering themselves,
 * so what the client sees is decided here — 401 for a guest, 403 for a user who
 * is signed in but lacks the item.
 *
 * Everything else stays a 500 on purpose. An `UnknownRuleError` means a rule was
 * never registered on this side; turning that into a 403 would hide a broken
 * configuration behind a plausible-looking "access denied".
 */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof RbacHttpError) {
    const body: ApiErrorBody = { status: error.status, error: error.message };
    if (error.required.length > 0) {
      body.required = [...error.required];
    }
    res.status(error.status).json(body);
    return;
  }

  if (error instanceof UnknownRuleError) {
    console.error(`Rule "${error.ruleName}" is not registered on the server.`);
  } else {
    console.error(error);
  }

  const message = error instanceof Error ? error.message : "Internal server error.";
  res.status(500).json({ status: 500, error: message } satisfies ApiErrorBody);
};
