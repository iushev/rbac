# Example: Express + React

A small blog in which both adapters work at the same time over the same RBAC graph:
[`rbac-express`](../../rbac-express) protects the routes on the server,
[`rbac-react`](../../rbac-react) decides what gets drawn in the UI at all, and the core,
[`rbac`](../../rbac), is the same in both places.

```bash
npm install
npm run dev      # API on :3000, UI on :5173
```

Open <http://localhost:5173> and switch users with the buttons in the top right.

For a production setup — a single process that serves both the API and the built UI:

```bash
npm run build
npm start        # http://localhost:3000
```

The other commands: `npm run typecheck`, `npm run format`, `npm run clean`.

## Users

There are no passwords — signing in is just picking a name, because authentication isn't
the subject of the example. What matters is what `getIdentity` returns to the middleware.

| User     | Role   | What it shows                                                 |
| -------- | ------ | ------------------------------------------------------------- |
| `bob`    | reader | sees the posts, has no buttons at all                         |
| `alice`  | author | writes, but edits and deletes only **their own** — via a rule |
| `root`   | admin  | can do everything with posts + the RBAC panel                 |
| `su`     | —      | `isSuperuser: true` — passes every check without the store    |
| `banned` | author | `isActive: false` — signs in, but is denied everywhere        |

A guest (not signed in) gets **401**, not 403: the request would pass if it carried an
identity. This distinction comes from the guards and is deliberate.

The inactive `banned` also shows the flip side: `matchRole` denies them everything,
including the special names `"?"` and `"@"`. That's why the sign-out button doesn't sit
behind `<Access>` — being signed in is session state, not a permission, and a control
behind a check would disappear exactly for the user who needs it. See
[src/web/components/UserSwitcher.tsx](src/web/components/UserSwitcher.tsx).

## The graph

```
admin  -> author
       -> updatePost, deletePost          (any post, no rule)
       -> manageRbac
author -> reader -> viewPost
       -> createPost
       -> updateOwnPost (rule: isAuthor) -> updatePost
       -> deleteOwnPost (rule: isAuthor) -> deletePost
```

`updatePost` has no rule of its own. An author reaches it only via `updateOwnPost`, whose
rule narrows it down to their own posts, while the administrator holds it directly and
passes for any post. The whole graph is built in [src/server/rbac.ts](src/server/rbac.ts)
over `InMemoryRbacStore`; in a real application `@iushev/rbac-db-sequelize` or
`@iushev/rbac-db-drizzle` takes its place and nothing else changes.

## What lives where

| File                                                                       | What it shows                                                          |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [src/server/main.ts](src/server/main.ts)                                   | `rbacMiddleware` once, at the top — for every request, guests included |
| [src/server/auth.ts](src/server/auth.ts)                                   | `getIdentity` — the only point where authentication hooks in           |
| [src/server/routes/posts.ts](src/server/routes/posts.ts)                   | `can("updatePost", { params })` — the resource reaches the rule        |
| [src/server/routes/admin.ts](src/server/routes/admin.ts)                   | `access(["admin"])` — "this screen is for these roles"                 |
| [src/server/main.ts](src/server/main.ts)                                   | `rbacController` behind a guard — CRUD over the RBAC data              |
| [src/server/errorHandler.ts](src/server/errorHandler.ts)                   | 401 / 403 from the guards; everything else stays a 500                 |
| [src/shared/rbac.ts](src/shared/rbac.ts)                                   | the rules — the same code for the server and the browser               |
| [src/web/accessChecker.ts](src/web/accessChecker.ts)                       | snapshot + assignments → `CheckAccess` in the browser                  |
| [src/web/session.tsx](src/web/session.tsx)                                 | `RbacProvider` with a new identity → a new `RbacUser`                  |
| [src/web/components/PostCard.tsx](src/web/components/PostCard.tsx)         | `<Can permission="updatePost" params={{ post }}>`                      |
| [src/web/components/GuardDemo.tsx](src/web/components/GuardDemo.tsx)       | `<Access roles={["@"]}>` — the special name for "signed in"            |
| [src/web/components/UserSwitcher.tsx](src/web/components/UserSwitcher.tsx) | why sign-out is **not** behind an access check                         |

## How the client gets the data

The server provides the graph via `toSnapshot` (`GET /api/snapshot`), and the current
user's assignments separately (`GET /api/session`) — the snapshot deliberately doesn't
contain them, because the client needs only its own. The browser builds an
`InMemoryRbacStore` from the snapshot, puts the assignments back into it and creates a
`CheckAccess` — **only** the read half; `RbacManager` stays on the server.

That's why `can()` in the UI doesn't send a request per button, and why the rules are
registered on both sides: the store holds only a rule name, and the code is in
[src/shared/rbac.ts](src/shared/rbac.ts).

## A hidden button is not protection

The "A hidden button is not protection" panel in the UI sends a
`PUT` to someone else's post — a request the UI offers no button for. The answer comes from
the guard: 403 for an author, 200 for an administrator. The React check decides what gets
drawn, the Express guard decides what happens; the second does not follow from the first.

## What is simplified

- The store is in memory — a restart brings back the sample data.
- No passwords and no real sessions: token → user in a single `Map`.
- The snapshot is served to everyone, guests included. If your graph is sensitive, give the
  client only the part it needs.
