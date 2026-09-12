# CLAUDE.md — examples/express-react

A demo blog over `rbac`, `rbac-express` and `rbac-react`. See [../../CLAUDE.md](../../CLAUDE.md)
for the monorepo conventions and [README.md](README.md) for how to run it and what it
shows.

## This is an example, not a package

Nothing here is published or part of the public API. The example has one job — to show how
the three packages work together in a real application — and everything else in this file
follows from it.

**No access logic is written here.** If the check needs new behavior, it belongs in `rbac`;
if Express needs a new guard — in `rbac-express`. Code in the example that decides on its
own whether someone has the right to something is a sign it's in the wrong place.

## Not a workspace

The example is a standalone npm project: its own `package.json`, its own `npm install`,
its own `package-lock.json`. The packages come in via `file:../../<package>`, meaning npm
symlinks them and they resolve by realpath — again to **`dist`**, not `src`.

Two consequences:

- the root commands (`npm test`, `npm run build`, `npm run lint`) do **not** touch it;
  a broken example doesn't break the monorepo, but a green root build doesn't mean the
  example works either;
- a change in `rbac` (or in an adapter) shows up here only after `npm run build -w rbac`
  from the root, just like with the other packages.

If you add a second example, do it the same way. Putting `examples/*` into `workspaces`
would force every example to carry `build`, `test`, `typecheck` and `lint` scripts, because
the root commands run with `--workspaces` without `--if-present`.

## Three parts, and why exactly three

| Part         | Compiled by                            | What it is                               |
| ------------ | -------------------------------------- | ---------------------------------------- |
| `src/server` | `tsc -p tsconfig.server.json` → `dist` | the Express application                  |
| `src/web`    | Vite → `dist/web`                      | the React application                    |
| `src/shared` | both                                   | what **must** be identical on both sides |

`src/shared` is not a folder for shared helpers. It holds only what would silently break
the example if it diverged: the rules ([src/shared/rbac.ts](src/shared/rbac.ts))
and the shape of the data over the wire ([src/shared/api.ts](src/shared/api.ts)).

Rules are code, not data — the store holds only a name. A new rule is registered both on
the server and in the browser, so it's written in `src/shared/rbac.ts` and nowhere else.
An unregistered rule throws `UnknownRuleError`; that's a configuration defect, not denied
access, and must not turn into a 403 (server) or a hidden button (UI).

## The two halves of the core cross the boundary

The server holds `RbacManager` — reads and mutations. The browser gets `CheckAccess` —
read-only, built in [src/web/accessChecker.ts](src/web/accessChecker.ts) from the snapshot
plus the current user's assignments. `RbacManager` must not appear in `src/web`.

The snapshot deliberately carries no assignments, so they come separately from
`GET /api/session` and are put back into the client store by hand. An assignment change →
a new store and a new checker; `refresh()` from `useRbac` only re-queries the same store
and on its own isn't enough. See `reload` in [src/web/session.tsx](src/web/session.tsx).

## What must not be broken

**A guard for every action the UI hides.** A new button in React → a new guard on the route
behind it. `rbac-react` decides what gets drawn, `rbac-express` decides what happens; the
second does not follow from the first. The panel in
[src/web/components/GuardDemo.tsx](src/web/components/GuardDemo.tsx) exists to show the
difference — it sends the request there's no button for.

**Guest 401, authenticated without permission 403.** The distinction comes from the guards;
the error handler [src/server/errorHandler.ts](src/server/errorHandler.ts) only carries it
over and leaves everything else as a 500.

**Session controls don't sit behind an access check.** `matchRole` denies an inactive user
everything, including the special `"?"` and `"@"`, so a sign-out behind `<Access>`
disappears exactly for `banned`. See the comment in
[src/web/components/UserSwitcher.tsx](src/web/components/UserSwitcher.tsx).

**`rbacController` runs behind a guard.** Without `guards` the router is open to everyone,
`DELETE /` included.

**`pending` is not merged with `fallback`.** The check is asynchronous; "no access" must not
flash in front of a user who has access.

## Small things that bite

- **`resolve.dedupe` in [vite.config.ts](vite.config.ts).** `rbac-react` is a symlink and
  resolves `react` from the monorepo root, while the app resolves it from its own
  `node_modules`. Two copies of React break hooks and context. Don't remove the dedupe.
- **`.js` in relative imports**, even when they point to `.ts` / `.tsx` — NodeNext, as in
  the packages. Vite resolves them by itself.
- **Two tsconfigs over one base.** [tsconfig.json](tsconfig.json) is the web part (DOM,
  `jsx`, `noEmit`), [tsconfig.server.json](tsconfig.server.json) is the server (no DOM,
  emits to `dist`). `npm run typecheck` runs both — server code that reaches for
  `document` fails there.
- **`npm start` requires a prior `npm run build`** and has to be run from the example's
  directory: the path to `dist/web` is relative to `cwd`.
- **The demo users live in two places** — [src/server/users.ts](src/server/users.ts) is the
  source of truth, [src/web/users.ts](src/web/users.ts) is only the list for the sign-in
  screen (a real application has a password form). A new user is added in both places.
- **The store is in memory.** A restart brings back the sample data; assignments made from
  the admin panel are lost. For a database, only the store in
  [src/server/rbac.ts](src/server/rbac.ts) changes.

## Files

Server:

| File                                                     | Contents                                 |
| -------------------------------------------------------- | ---------------------------------------- |
| [src/server/main.ts](src/server/main.ts)                 | middleware, route mounting, static files |
| [src/server/rbac.ts](src/server/rbac.ts)                 | the graph over `InMemoryRbacStore`       |
| [src/server/auth.ts](src/server/auth.ts)                 | `getIdentity` — the authentication point |
| [src/server/users.ts](src/server/users.ts)               | demo users and token sessions            |
| [src/server/posts.ts](src/server/posts.ts)               | the in-memory posts                      |
| [src/server/types.ts](src/server/types.ts)               | `Express.RbacIdentity` and `req.post`    |
| [src/server/routes/](src/server/routes/)                 | session / posts / admin                  |
| [src/server/errorHandler.ts](src/server/errorHandler.ts) | 401 / 403 out, the rest as 500           |

Client:

| File                                                 | Contents                                               |
| ---------------------------------------------------- | ------------------------------------------------------ |
| [src/web/accessChecker.ts](src/web/accessChecker.ts) | snapshot + assignments → `CheckAccess`                 |
| [src/web/session.tsx](src/web/session.tsx)           | the session, `RbacProvider`, `reload`                  |
| [src/web/api.ts](src/web/api.ts)                     | fetch with a token, `ApiError` carrying the status     |
| [src/web/usePosts.ts](src/web/usePosts.ts)           | the posts from a guarded endpoint                      |
| [src/web/App.tsx](src/web/App.tsx)                   | the layout and `<Access roles={["admin"]}>`            |
| [src/web/components/](src/web/components/)           | `Can` / `Access` in place, the error boundary          |
| [src/web/types.ts](src/web/types.ts)                 | `declare module "@iushev/rbac-react"` for the identity |

## Commands

```bash
npm install      # once; the example is not a workspace
npm run dev      # API :3000 + Vite :5173
npm run build    # tsc for the server, Vite for the UI
npm start        # a single process on :3000, after build
npm run typecheck
npm run format
```

No tests and no eslint — the behavior worth testing lives in the packages and is tested
there. If you're writing a test for something here, first check whether it belongs in
`rbac`, `rbac-express` or `rbac-react`.
