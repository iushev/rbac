# CLAUDE.md — rbac-tanstack

TanStack Start bindings over [`rbac`](../rbac). On npm it is `@iushev/rbac-tanstack`. See
[../CLAUDE.md](../CLAUDE.md) for the monorepo conventions and [README.md](README.md) for
usage.

## A thin adapter, not a second RBAC

The package only translates between Start and `rbac`. No access logic is written here —
every check goes through `RbacUser.can` or `matchRole` from the core. If you need new check
behavior, it belongs in `rbac`. A condition written here — "admins, and the author on
Tuesdays" — is a rule or an edge in the graph that ended up in the wrong place.

The sibling package is [`rbac-express`](../rbac-express) and the two are read together: the
same 401 / 403 distinction, the same names `can` and `access`, the same role for
`getIdentity`. If you change guard behavior here, check whether the change belongs there
too.

## Five parts

| File                                                                                                                         | What                                                   |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [src/middleware.ts](src/middleware.ts)                                                                                       | `rbacMiddleware` — sets `context.rbacUser`             |
| [src/guards.ts](src/guards.ts)                                                                                               | `can` / `access` as middleware, `requireCan` in a body |
| [src/errors.ts](src/errors.ts)                                                                                               | 401 / 403 and restoring them on the other side         |
| [src/serialization.ts](src/serialization.ts)                                                                                 | the denial and the graph across the RPC boundary       |
| [src/session.ts](src/session.ts) + [src/accessChecker.ts](src/accessChecker.ts) + [src/RbacSession.tsx](src/RbacSession.tsx) | server → browser and back into a check                 |

## What must not be broken

**`.server()` is the only place for server code.** Start's compiler strips its body from
the client bundle — and this applies to this package's `dist` too, because the compiler
also walks `node_modules`. That's why `setResponseStatus` is called inside `.server()`.
Move it to module level and `@tanstack/react-start/server` ships to the browser.

**Guest 401, authenticated without permission 403.** `denialFor` is the only place that
makes this distinction. A guest gets 401 because the request might pass if it carried an
identity.

**Anything that isn't a denial passes through unchanged.** `UnknownRuleError` from an
unregistered rule is a configuration defect, not denied access — don't wrap it in a 403.
The middleware touches the status only for `RbacHttpError`.

**A guard without `rbacMiddleware` throws a plain `Error`.** A missing `context.rbacUser` is
a programmer error, not a denial, and must not become a 403.

**`accessCheckerFor` and `rbacUserFor` cache by the session object.** This is not an
optimization: `use()` reruns the render that suspended on the promise, so a new promise on
every render means Suspense forever. The key is the session and only the session — a new
session, a new checker, and that's exactly how a changed assignment reaches the UI.

**`toSessionState` doesn't carry other users' assignments.** The snapshot is the graph
without assignments (that's by construction in the core), and only this user's go along
with it.

**`RbacIdentity` is filled in by the application.** The empty interface is deliberate —
it mirrors `Express.RbacIdentity` in `rbac-express` and `RbacIdentity` in `rbac-react`.

## Small things that bite

- **`getIdentity` and `accessChecker` are wrapped in `createServerOnlyFn` by the
  application.** The package can't do it on the application's behalf: the closure lives at
  the call site, and the compiler strips only what it sees there. Without the wrapper the
  session and the graph ship to the browser. This is also documented in the
  `rbacMiddleware` JSDoc — don't remove it.
- **`setStatus` applies to server function calls.** A document request denied in a loader
  comes back as a 500 from the router, whatever is set here. That's also why the option is
  turned off in the tests: `setResponseStatus` needs a request, and outside a server there
  isn't one.
- **The serialization adapters have an `rbac:` prefix in their key**, so they don't collide
  with the application's.
- **`jsx` and the DOM libs in [tsconfig.json](tsconfig.json)**, as in `rbac-react` —
  because of `RbacSession.tsx`. This is the second (and last) exception to the otherwise
  identical tsconfigs in the monorepo.
- **`<RbacSession>` suspends on `use`**, so a test that mounts it must render inside an
  awaited `act` — see [src/testing/render.tsx](src/testing/render.tsx). A render started
  outside such a scope stays on the fallback forever.

## Tests

`src/X.ts` ↔ `src/X.test.ts`, vitest, jsdom (for the component). The guards are run
through `runMiddleware` from [src/testing/middleware.ts](src/testing/middleware.ts), which
calls `middleware.options.server` directly — a full Start server isn't needed to check who
gets through and who doesn't.

The fixtures are the same blog graph as in `rbac-react`, so the tests read the same way.
