# Example: TanStack Start

The same blog as [express-react](../express-react), but without Express: the server is
[TanStack Start](https://tanstack.com/start), and the guarded route is replaced by a
guarded **server function**. The adapter is [`rbac-tanstack`](../../rbac-tanstack), the UI
uses [`rbac-react`](../../rbac-react), and the core, [`rbac`](../../rbac), is the same one
that protects the other example.

```bash
npm install
npm run dev      # http://localhost:5173
```

For a production setup:

```bash
npm run build
npm start        # SSR from the build, http://localhost:4173
```

The other commands: `npm run typecheck`, `npm run format`, `npm run clean`.

## Why it exists when there's already express-react

The two examples answer different questions.

`rbac-express` protects routes; `rbac-tanstack` protects server functions. The two adapters
say the same thing to two frameworks — the same 401 / 403, the same `can` and `access`, the
same role for `getIdentity` — and the examples show that side by side.

The second thing this example shows, and the other can't: **SSR**. The access check is
asynchronous, and whatever `beforeLoad` returns is serialized to the browser and not
executed a second time there. Together these two decide how the graph reaches the UI — and
that's why `rbac-tanstack` ships `<RbacSession>`, instead of every application writing it
anew.

## Users

There are no passwords — signing in is just picking a name, because authentication isn't
the subject of the example. What matters is what `getIdentity` returns in
[src/server/session.ts](src/server/session.ts).

| User     | Role   | What it shows                                                 |
| -------- | ------ | ------------------------------------------------------------- |
| `bob`    | reader | sees the posts, has no buttons at all                         |
| `alice`  | author | writes, but edits and deletes only **their own** — via a rule |
| `root`   | admin  | can do everything with posts + the RBAC panel                 |
| `su`     | —      | `isSuperuser: true` — passes every check without the store    |
| `banned` | author | `isActive: false` — signs in, but is denied everywhere        |

A guest gets **401**, and a signed-in user without the permission gets **403**: the first
would pass with an identity, the second wouldn't. The distinction is made once, in the
`rbac-tanstack` guards, and reaches the screen intact — thanks to the serialization
adapters registered in [src/start.ts](src/start.ts).

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
passes for any post. The graph is built in [src/server/graph.ts](src/server/graph.ts) —
the same graph as in the other example.

## The three places where access is checked

| Where                  | With what                    | What it protects                    |
| ---------------------- | ---------------------------- | ----------------------------------- |
| server function        | `requireCan` / `requireRole` | **the data** — this is the boundary |
| a route's `beforeLoad` | `matchRole` + `redirect`     | a screen that would be empty        |
| component              | `<Can>`, `<Access>`          | a button that would return 403      |

Only the first one is protection. The other two make the application bearable and can be
removed without opening anything up. The reverse doesn't hold: remove the guard from a
server function and it becomes public — callable with a single `fetch` from the console,
no matter what the UI draws.

Separate from these three is **CSRF**, registered in [src/start.ts](src/start.ts). It
doesn't answer "does this user have the right" but "did this user ask for this": server
functions are same-origin RPC endpoints that ride the session cookie, and a page on a
foreign site could call them as the signed-in user. The guard would let it through — the
caller _is_ the user. That's why the check comes before the guard, based on
`Sec-Fetch-Site` / `Origin`, and applies only to server functions: a document request is a
navigation, and arriving from a foreign site is exactly what a link is for.

The **Guards** page ([src/routes/guards.tsx](src/routes/guards.tsx)) exists
precisely to show this: its buttons aren't hidden — they send the requests the current user
has no right to make, and show what the guard answers.

The two `deletePost` probes there are a pair, and the difference between them is
`deleteOwnPost`: they ask for the same permission and differ only in the post. As Alice,
one passes and the other returns **403**, because an author reaches `deletePost` only via
`deleteOwnPost`, and the `isAuthor` rule compares the post's author with the user. As Root,
both pass — the admin holds `deletePost` directly. As Bob, neither passes, but for a
different reason: Bob has no delete permission at all. Three different answers to the same
question, and the graph is the only thing that tells them apart.

## How the graph reaches the browser

The server holds `RbacManager` — reads and mutations. The browser gets `CheckAccess` —
read-only, assembled by `<RbacSession>` from the snapshot plus the current user's
assignments. That's why the UI answers `can("updatePost")` on its own, without a request
per button, and gives the same answer as the guard: the rules are the same module on both
sides ([src/rbac/rules.ts](src/rbac/rules.ts)).

Three details that only show up with SSR:

- **`beforeLoad` is not executed a second time in the browser.** Whatever it returns is
  serialized into the HTML and read during hydration. That's why only the session travels
  in the context, while `CheckAccess` — which holds a store and functions — is built from
  it in both places. That's what `<RbacSession>` does, with `use` and a `<Suspense>` above
  it.
- **The snapshot goes through a serialization adapter** — `Rule.data` is `unknown`, and
  Start wants provably serializable types. The graph is JSON by construction, and that is
  declared once, in [src/start.ts](src/start.ts).
- **`<Can>` and `<Access>` draw `pending` during the server render.** The check is an
  effect, and effects don't run on the server. The buttons appear on hydration — that's
  why `pending`, not `fallback`, is what shows first.

## Files

| File                                           | Contents                                         |
| ---------------------------------------------- | ------------------------------------------------ |
| [src/server/rbac.ts](src/server/rbac.ts)       | all the wiring: which graph and which identity   |
| [src/server/graph.ts](src/server/graph.ts)     | the graph over `InMemoryRbacStore`               |
| [src/server/session.ts](src/server/session.ts) | `getIdentity` — the authentication point         |
| [src/fn/](src/fn/)                             | the server functions: session, posts, admin      |
| [src/rbac/rules.ts](src/rbac/rules.ts)         | the rules and the registry, shared by both sides |
| [src/start.ts](src/start.ts)                   | the serialization adapters                       |
| [src/routes/](src/routes/)                     | the routes, the `beforeLoad` guard, the panels   |
| [src/components/](src/components/)             | `<Can>` / `<Access>` in place                    |

Outside these files the application writes no checks: the guards, the denial, the
serialization and the bridge to `<RbacProvider>` come from
[`rbac-tanstack`](../../rbac-tanstack).
