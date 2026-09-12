# CLAUDE.md — examples/tanstack-start

A demo blog over `rbac`, `rbac-tanstack` and `rbac-react`. See
[../../CLAUDE.md](../../CLAUDE.md) for the monorepo conventions,
[../../rbac-tanstack/CLAUDE.md](../../rbac-tanstack/CLAUDE.md) for the adapter and
[README.md](README.md) for how to run it and what it shows.

## This is an example, not a package

Nothing here is published. The example has one job — to show how the core and
`rbac-react` work in an application without Express — and everything else follows from it.

**No access logic is written here.** The check lives in `rbac`, and its translation to
Start lives in `rbac-tanstack`. Code in the example that decides on its own whether someone
has the right to something is a sign it's in the wrong place; the same goes for code that
assembles a denial, a status or a checker by hand — the adapter already has that.

## Not a workspace

A standalone npm project: its own `package.json`, its own `npm install`, its own
`package-lock.json`. The packages come in via `file:../../<package>`, i.e. they resolve by
realpath — to **`dist`**, not `src`. The consequences are the same as for
[express-react](../express-react/CLAUDE.md): the root commands don't touch it, and a change
in `rbac` shows up here only after `npm run build -w rbac`.

## The difference from express-react

The two examples are the same application on different frameworks and are read together. If
you change behavior that both of them show — the graph, the rules, the demo users — change
it in both, otherwise the comparison stops working.

`rbac-express` knows what a route is, `rbac-tanstack` knows what a server function is. The
application tells each of them only two things: which graph to check against and who is
asking. Here that's [src/server/rbac.ts](src/server/rbac.ts) — twenty-odd lines, and not a
single access decision among them.

## What must not be broken

**A guard on every server function that touches anything.** A function without `can`,
`access` or `requireCan` is public: callable with a single `fetch` from the console, no
matter what the UI draws.

**The two `deletePost` probes in [src/routes/guards.tsx](src/routes/guards.tsx) are a pair.**
One targets a post by Alice, the other a post by Bob; separately, each shows only "yes" or
"no", but together they show `deleteOwnPost` — the same permission, a different answer,
because the `isAuthor` rule looks at the post. Remove one and the demonstration is gone.
The probes really delete, so the page says so: a deleted post then answers "no such
post" — an error, not a denial.
`beforeLoad` and `<Can>` don't replace this — they're UX. The
[src/routes/guards.tsx](src/routes/guards.tsx) page exists to show the difference: it sends
the requests there's no button for.

**Guest 401, authenticated without permission 403.** The distinction is made in
`rbac-tanstack` and nowhere else; the example only renders it, in
[src/components/Denial.tsx](src/components/Denial.tsx). The middleware translates it into
an HTTP status — for server function calls. For a document request the router responds
with a 500 for any error in a loader, so a guest's page is a 500; the guard's status is
visible in the RPC requests. This is framework behavior, not a defect in the example.

**The CSRF middleware in [src/start.ts](src/start.ts) is not part of the RBAC and is not to
be removed.** It answers "did this user ask for this", not "does this user have the right":
server functions ride the session cookie, so a foreign site could call them as the
signed-in user, and the guard would let it through — the caller really is the user. The
`filter` keeps it on server functions only; document requests are navigations and are let
through. If it's removed, Start itself warns on the first request.

**`rbacSerializationAdapters` are registered in [src/start.ts](src/start.ts).** Without
them a denial reaches the browser as a bare `Error` — just a message — and 401 / 403 merge
with "something broke" exactly where the difference matters.

**`beforeLoad` is not executed a second time in the browser.** Whatever it returns is
serialized into the HTML. That's why only `SessionState` travels in the context, while
`CheckAccess` is built from it in both places. Don't put `RbacUser`, `CheckAccess` or
anything else with methods into the context — the types won't allow it, and rightly so.

**`<RbacSession>` needs a `<Suspense>` above it** — see
[src/routes/\_\_root.tsx](src/routes/__root.tsx). Building the checker is asynchronous,
and in the browser there's no moment before the first render in which to wait; `use` makes
the server render and hydration the same path. The rules registry is passed as a module
constant ([src/rbac/rules.ts](src/rbac/rules.ts)) — the adapter's cache is keyed by the
session object, and a new registry on every render would only mislead the reader.

**A session or assignment change → `router.invalidate()`.** `refresh()` from `useRbac` only
re-queries the same store; the assignments live in that store, so a new one has to be
built. The invalidate reruns the root `beforeLoad`, which is the only place that loads the
session.

**Session controls don't sit behind an access check.** `matchRole` denies an inactive user
everything, including `"?"` and `"@"`, so a sign-out behind `<Access>` disappears exactly
for `banned`. See the comment in
[src/components/UserSwitcher.tsx](src/components/UserSwitcher.tsx).

**`pending` is not merged with `fallback`.** The check is asynchronous, and on the server it
stays asynchronous forever — effects don't run there, so the server render shows only
`pending`. "No access" must not flash in front of a user who has access.

## Small things that bite

- **`moduleResolution: "bundler"`, no `.js` in imports.** The generated
  `src/routeTree.gen.ts` imports without extensions, so NodeNext — the packages'
  resolution — doesn't work here. This is the only place in the monorepo with a different
  resolution.
- **`src/routeTree.gen.ts` is generated but committed**, so `npm run typecheck` works right
  after `npm install`. If you add a new route, run `npm run dev` or `npm run build` to
  regenerate it.
- **The entry file names are a contract**: `src/router.tsx` must export `getRouter`, and
  `src/start.ts` must export `startInstance`. Rename them and the build stops finding them.
- **`resolve.dedupe` in [vite.config.ts](vite.config.ts).** `rbac-react` is a symlink and
  resolves `react` from the monorepo root, while the app resolves it from its own
  `node_modules`. Two copies of React break hooks and context.
- **Server modules carry `import "@tanstack/react-start/server-only"`.** The compiler
  strips the bodies of `.server()` and `.handler()` from the client bundle, and the marker
  is what blows up if a path to them is ever left open.
- **`createServerOnlyFn` in [src/server/rbac.ts](src/server/rbac.ts) is not redundant.**
  This module is also imported by the browser — for the client half of the server
  functions — and the two callbacks reach for the session and the graph. Without the
  wrapper, `node:crypto` and the demo users ship to the browser. Verify by grepping
  `dist/client/assets` after `npm run build`.
- **The store is in memory.** A restart brings back the sample data; assignments made from
  the admin panel are lost. For a database, only the store in
  [src/server/graph.ts](src/server/graph.ts) changes.
- **The demo users live in two places** — [src/server/users.ts](src/server/users.ts) is the
  source of truth, the list in [src/components/UserSwitcher.tsx](src/components/UserSwitcher.tsx)
  is only the sign-in screen. A new user is added in both places.

## Commands

```bash
npm install      # once; the example is not a workspace
npm run dev      # http://localhost:5173
npm run build
npm start        # SSR from the build, http://localhost:4173
npm run typecheck
npm run format
```

No tests and no eslint — the behavior worth testing lives in the packages and is tested
there. If you're writing a test for something here, first check whether it belongs in
`rbac` or `rbac-react`.
