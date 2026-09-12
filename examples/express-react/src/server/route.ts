import type { Request, RequestHandler, Response } from "express";

/**
 * Express 5 does not await handlers, so a rejected promise would never reach the
 * error handler. Every async route in the app goes through this wrapper — the
 * same pattern `rbac-express` uses internally.
 */
export function route(handler: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void handler(req, res).catch(next);
  };
}
