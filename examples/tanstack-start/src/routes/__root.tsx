import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { RbacSession } from "@iushev/rbac-tanstack";
import { Suspense, type ReactNode } from "react";

import { Header } from "../components/Header.js";
import { getSessionState } from "../fn/session.js";
import { DEFAULT_ROLES, rules } from "../rbac/rules.js";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "RBAC · TanStack Start" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),

  /**
   * The one place the authorization data is loaded, for the server render and
   * for every navigation after it.
   *
   * It is `beforeLoad` and not a loader because the routes below read it in
   * *their* `beforeLoad` — a redirect has to be decided before the route
   * starts loading. `router.invalidate()` after a login re-runs this, which is
   * what makes a new identity reach the whole tree at once.
   *
   * Only the session travels: what `beforeLoad` returns is serialized into the
   * HTML for the browser to pick up, so a checker — which holds a store and
   * the rule functions — could not ride along even if it wanted to.
   */
  beforeLoad: async () => ({ session: await getSessionState() }),

  shellComponent: RootDocument,
  component: RootComponent,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { session } = Route.useRouteContext();

  return (
    <div className="page">
      {/* `<RbacSession>` renders with `use`, so it needs a boundary above it. */}
      <Suspense fallback={<p className="notice">Loading…</p>}>
        <RbacSession session={session} rules={rules} defaultRoles={DEFAULT_ROLES}>
          <Header />
          <main>
            <Outlet />
          </main>
          <footer>
            Demo of <code>@iushev/rbac</code>, <code>@iushev/rbac-tanstack</code> and{" "}
            <code>@iushev/rbac-react</code> on TanStack Start.
          </footer>
        </RbacSession>
      </Suspense>
    </div>
  );
}
