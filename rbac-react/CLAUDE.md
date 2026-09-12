# CLAUDE.md — rbac-react

React bindings over [`rbac`](../rbac). On npm it is `@iushev/rbac-react`. See
[../CLAUDE.md](../CLAUDE.md) for the monorepo conventions and [README.md](README.md) for
usage.

## A thin adapter, not a second RBAC

Like `rbac-express`, the package only translates — this time between React and `rbac`. No
access logic is written here: everything goes through `RbacUser.can` and `matchRole` from
the core. If you need new check behavior, it belongs in `rbac`.

The four parts:

- [src/RbacProvider.tsx](src/RbacProvider.tsx) — holds a single `RbacUser` in context;
- [src/useCan.ts](src/useCan.ts) and [src/useAccess.ts](src/useAccess.ts) — hooks
  over `can` and `matchRole`;
- [src/Can.tsx](src/Can.tsx) and [src/Access.tsx](src/Access.tsx) — the same checks
  as components;
- [src/useAccessCheck.ts](src/useAccessCheck.ts) — the shared machinery beneath the hooks.

`Can` is for `useCan`, `Access` is for `useAccess` — the components do nothing beyond
choosing what to render. New behavior is added in the hook, so both paths get it.

## The check is asynchronous, the UI is synchronous

`RbacUser.can` returns a promise, so **every** first render is `pending`. Two decisions
follow from this, and they must not be broken:

`pending` is a separate prop from `fallback`. If a missing `pending` fell back to
`fallback`, the "no access" message would flash in front of every user, including those
who have access. Both default to `null`.

The answer is **stamped** with the check that produced it. In
[src/useAccessCheck.ts](src/useAccessCheck.ts) the state holds the `check` closure itself
and is returned only while that closure is still the current one; otherwise the result is
`PENDING`. That's why changing the permission, the user or `params` shows pending rather
than the answer to the previous question. If you ever replace this with a plain
`useState` + `useEffect`, you'll return the stale answer for one render.

A superseded check isn't aborted (it can't be) — its result is simply discarded by the
cleanup so it doesn't overtake the newer one.

## Why `params` isn't in the deps directly

`params={{ post }}` is a new object on every render. If it went straight into the
`useCallback` deps, the check would run endlessly. So it goes through `useStableParams`
from [src/deps.ts](src/deps.ts) — a shallow comparison that returns the previous object as
long as the values are the same. The same goes for `roles` in `useAccess`.

`logging` is deliberately **not** a dependency: it's kept in a `useLatest` ref and read on
the next check. An inline log function must not restart checks.

`revision` from the context is a dependency without being used inside the closure — that
is the entire mechanism behind `refresh()`. Don't remove it as "unnecessary".

## Which errors are denials and which aren't

| Situation                     | Result                         |
| ----------------------------- | ------------------------------ |
| the user lacks the permission | `fallback`                     |
| guest                         | `fallback` (no 401 equivalent) |
| `checkAccess` threw           | the error is thrown upward     |

The distinction is the same as in `rbac-express`: `UnknownRuleError` and the like are a
configuration defect, not denied access. `Can` and `Access` throw them so an error boundary
catches them; the hooks return them in `error`. Don't turn them into a denial — a broken
rule would then silently hide the UI instead of blowing up.

Unlike Express, there's no difference here between a guest and an authenticated user
without permissions: both see `fallback`. Who gets redirected where is the application's
decision, not the package's.

## The identity

`RbacIdentity` in [src/types.ts](src/types.ts) mirrors `Express.RbacIdentity` from
`rbac-express`: an empty interface the application extends via
`declare module "@iushev/rbac-react"`. That's why the package has no generics — don't add
any, and don't put application-specific fields here.

## The provider and the cache

A new `identity` prop → a new `RbacUser` via `useMemo`. That's also how the old user's
access cache gets left behind — don't touch the `user.identity` setter from the provider;
a mutation on the object is invisible to React.

`refresh()` does two things at once: `clearAccessCache()` on the user and `revision + 1`,
which restarts every mounted check. One without the other doesn't work — clearing the cache
without a revision bump recomputes nothing, and a revision bump without clearing the cache
returns the same answer.

The provider accepts either `user` or `accessChecker` — a union type with `?: never` on
both sides, so the two can't be passed together.

## Tests

jsdom + `@testing-library/react`, no network and no database. The RBAC graph is the blog
fixture from [src/testing/blog.ts](src/testing/blog.ts) — the same one as in
`rbac-express`; the users are in [src/testing/users.ts](src/testing/users.ts)
(`alice` — author, `bob` — reader, `root` — admin, `su` — superuser, `banned` —
inactive).

`renderWithRbac` from [src/testing/render.tsx](src/testing/render.tsx) mounts under a
provider. It has its own `rerender` because RTL's replaces the whole tree and would throw
away the provider; this one also accepts a new identity.

Vitest runs without `globals`, so the cleanup after each test is hooked up manually in
[src/testing/setup.ts](src/testing/setup.ts).

Test files are `.tsx` — `vitest.config.ts` includes both extensions.

```bash
npm test
npm run typecheck
npm run lint
```

A change in `../rbac` requires `npm run build -w rbac` from the root to be visible here.
