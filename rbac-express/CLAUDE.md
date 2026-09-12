# CLAUDE.md — rbac-express

Express 5 middleware over [`rbac`](../rbac). On npm it is `@iushev/rbac-express`. See
[../CLAUDE.md](../CLAUDE.md) for the monorepo conventions and [README.md](README.md) for
usage.

## A thin adapter, not a second RBAC

The package only translates between Express and `rbac`. No access logic is written here —
everything goes through `RbacUser.can` and `matchRole` from the core. If you need new check
behavior, it belongs in `rbac`.

The three parts:

- [src/middleware.ts](src/middleware.ts) — `rbacMiddleware` attaches `req.rbacUser`;
- [src/guards.ts](src/guards.ts) — `can(permission)` and `access(roles)` as per-route
  `RequestHandler`s;
- [src/controller.ts](src/controller.ts) — `rbacController`, a router with CRUD
  endpoints over `RbacManager`.

## `rbacMiddleware` runs for every request, guests included

This is deliberate: `req.rbacUser` always exists (for a guest — with `identity: null`), and
there's a single access cache for the whole request. Don't make it conditional.

`getIdentity(req)` is the only point where the application's authentication hooks in —
passport, session, JWT, whatever. The package doesn't authenticate and must not start to.

A guard that doesn't find `req.rbacUser` throws a plain `Error` telling you to mount the
middleware — this is a programmer error, not an access denial, and must not become a 403.

## Which errors are denials and which aren't

| Situation                                 | Result              | Status |
| ----------------------------------------- | ------------------- | ------ |
| guest                                     | `UnauthorizedError` | 401    |
| authenticated, but without the permission | `ForbiddenError`    | 403    |

A guest gets 401, not 403, because the request might pass if it carried an identity. Keep
this distinction.

Everything else — a failing `params` resolver, `UnknownRuleError` from an unregistered
rule — goes to `next()` **unchanged**. Don't wrap such errors in a 403: they're a
configuration defect, not denied access.

By default a guard passes the error to `next()` rather than writing the response itself —
the behavior stays in the application's error handler. `onDenied` is the way out for a
denial that isn't JSON (a redirect to the login page, for example); it receives a
`DenialContext` with `req`, `user`, `required`, `params` and `error`.

## The controller is also translation, not logic

Every route in [src/controller.ts](src/controller.ts) ends in a call to `RbacManager`. The
validation that decides whether a change is allowed stays in the core — the controller
just asks it up front, so that the result is an HTTP status rather than a 500:

- before `addChild` it asks `canAddChild` → a rejection becomes a 400;
- before `add` / `update` it checks whether the name is free → a taken name becomes a 409;
- a missing item or rule is a 404.

Don't write checks here that `RbacManager` already does, and don't add new graph-validity
rules — they belong in `rbac`.

`rbacController` doesn't authorize. The `guards` option only mounts the given handlers in
front of the routes; the router without a guard is open to everyone, including `DELETE /`
(a full wipe). This is deliberate: who has the right to touch the RBAC data is the
application's decision.

Items share a single namespace, so lookups by name go through both types
(`getRole` ?? `getPermission`), and `/roles/:name` returns 404 for a name that is a
permission.

## The async pattern in handlers

Express 5 doesn't await promises from middleware. So both the middleware and the guards are
synchronous functions that launch an IIFE:

```ts
return (req, res, next) => {
  void (async () => {
    /* ... */
  })().catch(next);
};
```

Follow the same pattern for a new handler — otherwise a rejected promise doesn't reach the
error handler.

## Types

`req.rbacUser` is declared globally in [src/types.ts](src/types.ts) via
`declare global { namespace Express }`. User fields are extended by the application via
`Express.RbacIdentity` — don't add application-specific fields here.

## Behavior inherited from `rbac`

These live in the core; they only surface here, and the tests cover them:

- a superuser (`isSuperuser: true`) holds everything without touching the store —
  including roles on a deny list, so `access([...], { allow: false })` denies them
  too;
- an inactive user (`isActive: false`) is denied everywhere;
- the cache in `req.rbacUser` keeps only checks **without** `params`.

## Tests

No database and no network: supertest over the app from
[src/testing/app.ts](src/testing/app.ts) — a single route, `GET /resource`; the identity
comes from the `x-user` header, and the error handler returns JSON so the test can assert
on status and payload. The users are in `USERS` (`alice`, `bob`, `root`, `su` — superuser,
`banned` — inactive).

The RBAC graph is the blog fixture from [src/testing/blog.ts](src/testing/blog.ts).

The controller is tested via `buildControllerApp` from the same file — it mounts the router
at `/rbac` over the same fixture.

```bash
npm test
npm run typecheck
npm run lint
```

A change in `../rbac` requires `npm run build -w rbac` from the root to be visible here.
