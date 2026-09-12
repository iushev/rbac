# rbac-tanstack

[TanStack Start](https://tanstack.com/start) bindings over [`rbac`](../rbac) — protects
server functions, carries a denial to the browser intact, and assembles the check on the
client side.

## Install

```bash
npm install @iushev/rbac-tanstack
```

Peer dependencies: `@iushev/rbac`, `@iushev/rbac-react`, `react`, `@tanstack/react-start` and
`@tanstack/react-router`.

## What it does

The server half:

| What                          | For                                                                    |
| ----------------------------- | ---------------------------------------------------------------------- |
| `rbacMiddleware(options)`     | attaches `context.rbacUser` to every server function                   |
| `can(name)` / `access(roles)` | guards as middleware                                                   |
| `requireCan` / `requireRole`  | the same checks in the handler body, when the resource is loaded there |
| `toSessionState(store, user)` | the graph + the current user's assignments, for the browser            |

The client half:

| What               | For                                                                   |
| ------------------ | --------------------------------------------------------------------- |
| `<RbacSession>`    | from the session to a mounted `<RbacProvider>`                        |
| `accessCheckerFor` | a `CheckAccess` for a given session, cached                           |
| `rbacUserFor`      | the same, already bound to the identity — for a guard in `beforeLoad` |

And across the boundary:

| What                        | For                                                           |
| --------------------------- | ------------------------------------------------------------- |
| `rbacSerializationAdapters` | the denial and the graph survive serialization to the browser |
| `UnauthorizedError` (401)   | guest — the request would pass with an identity               |
| `ForbiddenError` (403)      | signed in, but without the permission                         |

## Usage

### 1. Middleware

The application says only two things: which graph to check against and who is asking.

```ts
// src/server/rbac.ts
import { createServerOnlyFn } from "@tanstack/react-start";
import { rbacMiddleware } from "@iushev/rbac-tanstack";

export const rbac = rbacMiddleware({
  accessChecker: createServerOnlyFn(async () => (await getRbac()).manager),
  getIdentity: createServerOnlyFn(() => readSession()),
});
```

`createServerOnlyFn` is not decoration. The module that mounts the middleware is also
imported by the browser — for the client half of the server functions — and the compiler
strips the body of a server-only function from there. A plain arrow function would stay,
along with everything it imports.

### 2. Guards

```ts
import { createServerFn } from "@tanstack/react-start";
import { can, access, requireCan } from "@iushev/rbac-tanstack";

export const listPosts = createServerFn({ method: "GET" })
  .middleware([rbac, can("viewPost")])
  .handler(() => posts.list());

export const listUsers = createServerFn({ method: "GET" })
  .middleware([rbac, access(["admin"])])
  .handler(() => users.all());
```

The middleware from `rbacMiddleware()` goes **first** in the array: it puts the user in the
context, and the guard reads it from there.

When the rule needs the resource, the check moves down into the handler — the guard judges
the post, not the id someone sent:

```ts
export const updatePost = createServerFn({ method: "POST" })
  .middleware([rbac])
  .validator((value: { id: number; title: string }) => value)
  .handler(async ({ context, data }) => {
    const post = loadPost(data.id);
    await requireCan(context.rbacUser, "updatePost", { post });
    return posts.update(post, data);
  });
```

A function without a guard is public — it can be called with a single `fetch` from the
console, regardless of what the UI draws.

The guard answers "does this user have the right", not "did this user ask for this". The
second is CSRF and isn't covered here: server functions are same-origin RPC endpoints that
ride the session cookie, so a foreign site could call them as the signed-in user — and the
guard would let it through, because the caller really is the user. That's why the
application also registers Start's `createCsrfMiddleware`:

```ts
export const startInstance = createStart(() => ({
  requestMiddleware: [createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" })],
  serializationAdapters: [...rbacSerializationAdapters],
}));
```

### 3. Serialization

```ts
// src/start.ts
import { createStart } from "@tanstack/react-start";
import { rbacSerializationAdapters } from "@iushev/rbac-tanstack";

export const startInstance = createStart(() => ({
  serializationAdapters: [...rbacSerializationAdapters],
}));
```

Without them a denial reaches the browser as a bare `Error` — just a message — and 401
merges with 403 exactly where the difference matters. The second adapter is for the graph:
`Rule.data` is `unknown`, and Start wants provably serializable types.

### 4. The session and the UI

The server gives the browser the graph and the current user's assignments:

```ts
export const getSession = createServerFn({ method: "GET" })
  .middleware([rbac])
  .handler(({ context }) => toSessionState(store, context.rbacUser.identity));
```

The browser turns them back into a check:

```tsx
export const Route = createRootRoute({
  beforeLoad: async () => ({ session: await getSession() }),
  component: () => (
    <Suspense fallback={<Loading />}>
      <RbacSession session={Route.useRouteContext().session} rules={rules}>
        <Outlet />
      </RbacSession>
    </Suspense>
  ),
});
```

From there on, `<Can>`, `<Access>` and the hooks from [`rbac-react`](../rbac-react) work,
and the UI answers `can()` on its own — without a request per button and with the same
answer as the guard, because the rules are the same module on both sides.

`<RbacSession>` renders with `use` and needs a `<Suspense>` above it. The reason is SSR:
whatever `beforeLoad` returns is serialized into the HTML and is **not** executed a second
time in the browser, so there's no moment before the first client render in which to wait
for anything. `use` makes the server render and hydration the same path.

### 5. Route guard

```ts
export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ context }) => {
    const user = await rbacUserFor(context.session, { rules });
    if (!(await matchRole({ user, roles: ["admin"] }))) {
      throw redirect({ to: "/" });
    }
  },
});
```

This is **not** protection — it only keeps the user away from a screen that would be empty
for them. What protects is the guard on the server functions that screen calls.

## The identity

`RbacIdentity` is an empty interface the application fills in:

```ts
declare module "@iushev/rbac-tanstack" {
  interface RbacIdentity {
    displayName: string;
  }
}
```

`rbac-react` ships an interface with the same name for the browser. One user — the same
fields in both places.

## Example

[examples/tanstack-start](../examples/tanstack-start) is a blog where all of this works
together: guarded server functions, a `beforeLoad` redirect, `<Can>` / `<Access>` in the
UI, and a panel that sends the requests there's no button for.
