import type { RbacContext } from "../types.js";

/**
 * The shape of a middleware's server handler, as the tests call it.
 *
 * A middleware built by `createMiddleware` keeps its handler on `options.server`,
 * which is enough to exercise a guard without a running Start server: the
 * handler only ever needs `data`, the context before it and a `next`.
 */
interface MiddlewareLike {
  options: {
    server?: (ctx: {
      next: (opts?: { context?: Record<string, unknown> }) => Promise<{
        context: Record<string, unknown>;
      }>;
      data: unknown;
      context: Record<string, unknown>;
      method: string;
      signal: AbortSignal;
      serverFnMeta: { id: string };
    }) => Promise<{ context: Record<string, unknown> }>;
  };
}

/** Runs one middleware and returns the context it passed on. */
export async function runMiddleware(
  middleware: unknown,
  options: { data?: unknown; context?: Record<string, unknown> } = {},
): Promise<Record<string, unknown>> {
  const server = (middleware as MiddlewareLike).options.server;
  if (!server) {
    throw new Error("The middleware has no server handler.");
  }

  const incoming = options.context ?? {};
  const result = await server({
    next: (next) => Promise.resolve({ context: { ...incoming, ...(next?.context ?? {}) } }),
    data: options.data,
    context: incoming,
    method: "POST",
    signal: new AbortController().signal,
    serverFnMeta: { id: "test" },
  });

  return result.context;
}

/** The user a middleware chain left behind, for the assertions that need it. */
export function rbacUserOf(context: Record<string, unknown>): RbacContext["rbacUser"] {
  const user = (context as Partial<RbacContext>).rbacUser;
  if (!user) {
    throw new Error("The context carries no rbacUser.");
  }
  return user;
}
