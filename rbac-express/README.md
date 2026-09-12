# rbac-express

Express middleware over [`rbac`](../rbac) — controls access to endpoints by roles and permissions.

## Install

```bash
npm install @iushev/rbac-express
```

`express` (5.x) and `@iushev/rbac` are peer dependencies:

```bash
npm install express @iushev/rbac
```

## Usage

A single app-level middleware attaches `req.rbacUser`, after which the guards are placed on
the routes:

```ts
import express from "express";
import { RbacManager } from "@iushev/rbac";
import { rbacMiddleware, can, access } from "@iushev/rbac-express";

const manager = new RbacManager({ store, rules });
const app = express();

app.use(
  rbacMiddleware({
    accessChecker: manager,
    // this is where your authentication hooks in — passport, session, JWT, whatever you use
    getIdentity: (req) => req.session.user ?? null,
  }),
);

app.get("/posts/:id", can("viewPost"), handler);
app.post("/posts", can("createPost"), handler);
app.use("/admin", access(["admin"]));
```

`getIdentity` returns `{ username, isActive, isSuperuser }`, or `null` for a guest.
The middleware runs for every request, guests included — so `req.rbacUser` is always
available, and there's one access cache per request.

### `can(permissionName, options?)`

Lets the request through if the user holds the permission — directly, or through the role
hierarchy.

Rules receive `params`, which is the place for a resource loaded earlier in the chain:

```ts
router.put(
  "/posts/:id",
  loadPost, // sets req.post
  can("updatePost", { params: (req) => ({ post: req.post }) }),
  handler,
);
```

`params` can be an object or an (async) function of the request.

### `access(roles, options?)`

Lets the request through if the user matches any of the names. Two names are special:
`"?"` matches a guest, `"@"` any authenticated user. An empty list lets everyone through.

```ts
router.use("/admin", access(["admin"]));
router.get("/login", access(["?"])); // unauthenticated users only
router.get("/profile", access(["@"])); // anyone signed in
```

With `{ allow: false }` the list becomes a deny list.

## Access denial

By default a guard passes an error to `next()` instead of writing a response itself — so
the behavior stays in the application's error handler:

| Situation                                 | Error               | Status |
| ----------------------------------------- | ------------------- | ------ |
| guest                                     | `UnauthorizedError` | 401    |
| authenticated, but without the permission | `ForbiddenError`    | 403    |

A guest gets 401, not 403, because the request might pass if it carried an identity.

Both extend `RbacHttpError`, with `status` / `statusCode` (like `http-errors`) and
`required` — the names the guard asked for:

```ts
import { RbacHttpError } from "@iushev/rbac-express";

app.use((err, req, res, next) => {
  if (err instanceof RbacHttpError) {
    res.status(err.status).json({ error: err.message, required: err.required });
    return;
  }
  next(err);
});
```

For a denial that isn't a JSON response — for example, a redirect to the login page — pass
`onDenied`:

```ts
can("createPost", {
  onDenied: (context, res) => {
    res.redirect(`/login?next=${context.req.originalUrl}`);
  },
});
```

`context` carries `req`, `user`, `required`, `params` and `error` — the error the guard
would otherwise have passed to `next()`.

Errors that aren't access denials — a failing `params` resolver, an unregistered rule
(`UnknownRuleError`) — go to `next()` unchanged instead of being turned into a 403.

## A controller for the RBAC data

`rbacController` is a router with CRUD endpoints over `RbacManager` — roles, permissions,
rules, the hierarchy and assignments. It doesn't authorize on its own, so mount it behind a
guard:

```ts
import { rbacController, access } from "@iushev/rbac-express";

app.use("/rbac", access(["admin"]), rbacController({ manager }));
```

Guards can also be passed to the router itself — handy when it's mounted in several
places:

```ts
app.use("/rbac", rbacController({ manager, guards: [access(["admin"])] }));
```

The router adds `express.json()` itself. If the application already parses bodies with
something other than `express.json()`, turn it off with `{ parseJson: false }`.

### Endpoints

| Method   | Path                               | Action                                              |
| -------- | ---------------------------------- | --------------------------------------------------- |
| `GET`    | `/roles`, `/permissions`           | all roles / permissions                             |
| `POST`   | `/roles`, `/permissions`           | creates (201 with the item)                         |
| `DELETE` | `/roles`, `/permissions`           | deletes all of that type                            |
| `GET`    | `/roles/:name`                     | a single role (404 if the name is a permission)     |
| `PUT`    | `/roles/:name`                     | replaces; a different `name` in the body renames it |
| `DELETE` | `/roles/:name`                     | deletes the role                                    |
| `GET`    | `/roles/:name/users`               | the users with this role                            |
| `GET`    | `/rules`, `/rules/:name`           | rules (only `name` and `data`)                      |
| `POST`   | `/rules`                           | creates a rule                                      |
| `PUT`    | `/rules/:name`                     | replaces / renames a rule                           |
| `DELETE` | `/rules`, `/rules/:name`           | deletes                                             |
| `GET`    | `/items`, `/items/:name`           | roles and permissions together                      |
| `GET`    | `/items/:name/children`            | the direct children                                 |
| `POST`   | `/items/:name/children`            | adds a child: `{ "name": "viewPost" }`              |
| `DELETE` | `/items/:name/children/:child`     | removes one link                                    |
| `DELETE` | `/items/:name/children`            | removes all links from this parent                  |
| `GET`    | `/assignments/:username`           | the user's assignments                              |
| `POST`   | `/assignments/:username`           | assigns: `{ "name": "author" }`                     |
| `DELETE` | `/assignments/:username/:itemName` | revokes one assignment                              |
| `DELETE` | `/assignments/:username`           | revokes all of the user's assignments               |
| `DELETE` | `/assignments`                     | revokes all assignments                             |
| `DELETE` | `/`                                | deletes all authorization data                      |

The body of a role / permission is `{ name, description?, ruleName?, data? }`, and of a
rule — `{ name, data? }`. On `PUT` a missing `name` means "keep the name from the path".

### Errors

The same `RbacHttpError` subclasses, passed to `next()`, so the error handler from above
covers them:

| Situation                                                     | Error             | Status |
| ------------------------------------------------------------- | ----------------- | ------ |
| a body the API can't work with; a link rejected by the core   | `BadRequestError` | 400    |
| an unknown item or rule name                                  | `NotFoundError`   | 404    |
| a name already taken; a parent-child link that already exists | `ConflictError`   | 409    |

The checks that decide what is a 400 — a cycle in the hierarchy, a role under a
permission — are the core's `canAddChild`; the controller just asks it before writing.

## Types

`req.rbacUser` is declared globally. If your user has extra fields, extend
`Express.RbacIdentity`:

```ts
declare global {
  namespace Express {
    interface RbacIdentity {
      id: number;
      email: string;
    }
  }
}
```

## Quirks inherited from `rbac`

- A superuser (`isSuperuser: true`) holds everything without touching the store — including
  roles on a deny list, so `access([...], { allow: false })` denies them too.
- An inactive user (`isActive: false`) is denied everywhere.
- Results are cached in `req.rbacUser` for the duration of the request, but only for checks
  without `params`.

## Development

```bash
npm run build      # compiles src/ -> dist/
npm run dev        # tsc --watch
npm run typecheck  # type check without emit
npm test           # vitest
npm run lint       # eslint (typed rules)
npm run format     # prettier --write
```

## License

MIT
