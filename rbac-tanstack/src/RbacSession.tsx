import { use, type ReactNode } from "react";
import { RbacProvider } from "@iushev/rbac-react";

import { rbacUserFor, type AccessCheckerOptions } from "./accessChecker.js";
import type { RbacSessionState } from "./types.js";

export interface RbacSessionProps extends AccessCheckerOptions {
  /** What the server sent: the graph, the identity, and its assignments. */
  session: RbacSessionState;
  children?: ReactNode;
}

/**
 * Turns the session a route loaded into a mounted `<RbacProvider>`.
 *
 * ```tsx
 * <Suspense fallback={<Loading />}>
 *   <RbacSession session={session} rules={rules}>
 *     <Outlet />
 *   </RbacSession>
 * </Suspense>
 * ```
 *
 * It needs a `<Suspense>` boundary above it, because it renders with `use`.
 * That is not decoration: building the checker is asynchronous, `beforeLoad`
 * does not run a second time in the browser — what it returns is serialized
 * into the HTML — and so there is no moment before the first client render in
 * which to await anything. `use` makes the server render and the hydration one
 * code path.
 *
 * A new session builds a new user, and a new user is what leaves the access
 * cache of the previous one behind. Reload the route that produced the session
 * — `router.invalidate()` — after a login or a changed assignment; `refresh()`
 * from `useRbac` only re-runs the checks against the same store.
 */
export function RbacSession({ session, children, ...options }: RbacSessionProps) {
  const user = use(rbacUserFor(session, options));

  return <RbacProvider user={user}>{children}</RbacProvider>;
}
