# CLAUDE.md — rbac

The RBAC core: types, interfaces and access checks. See
[../CLAUDE.md](../CLAUDE.md) for the monorepo conventions and [README.md](README.md)
for usage.

## Hard rule: no runtime dependencies

`package.json` has no `dependencies` and never will. The package compiles and runs the
same on the server, in the browser and in React Native. Don't import anything external —
neither a node builtin (`fs`, `crypto`, `path`) nor a helper library. `lib` in
`tsconfig.json` is just `["ES2022"]`, without `DOM`, precisely to make this visible.

Everything external (vitest, eslint, typescript) is in `devDependencies`.

## The two halves

The split is the main architectural decision and runs through the whole package:

- **`CheckAccess`** ([src/CheckAccess.ts](src/CheckAccess.ts)) — read-only, over
  `RbacStore` (8 methods). This is the code that ships to the client.
- **`RbacManager extends CheckAccess`** ([src/RbacManager.ts](src/RbacManager.ts)) —
  adds the mutations, over `RbacManagerStore`. Server only.

That's why `RbacManager` is also an access checker — the server has one object for both.

If you add a method, decide which side it belongs to. A method that only reads goes in
`CheckAccess` and must work with `RbacStore` — don't extend `RbacStore` with something a
client won't want to implement.

## Invariants kept here, not in the stores

`RbacManager` is the place for backend-independent policy:

- `addChild` rejects a cycle and a role under a permission;
- `add`/`update` of an item pointing to a nonexistent rule creates a placeholder
  rule, so the reference stays valid;
- `CheckAccess.checkItem` carries a `visited` set — the traversal stops on a cycle and
  doesn't check an item twice when several paths lead to it.

Don't duplicate these checks in `rbac-db-sequelize`. If you add a new one, also add a test
in [src/RbacManager.test.ts](src/RbacManager.test.ts) — the same file is run against
Postgres by `rbac-db-sequelize`.

## Items are not classes

`Role` and `Permission` are **interfaces**, not classes. An item that came over the network
is a plain object and `instanceof` on it is always `false`. Distinguish by `item.type` —
via `isRole` / `isPermission` from [src/Item.ts](src/Item.ts). They are built with
`createRole` / `createPermission`.

The same goes for `Assignment` and `Rule`.

## Rules are code, not data

The store holds only a rule name and a text `data`. The implementations are registered in
`RuleRegistry` at startup, separately on the server and on the client. An item pointing to
an unregistered rule throws `UnknownRuleError` during a check — this is deliberate and must
not be turned into "access denied".

## Files

| File                                                 | Contents                                                        |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| [src/Item.ts](src/Item.ts)                           | `Item`/`Role`/`Permission`, factories, type guards              |
| [src/Rule.ts](src/Rule.ts)                           | `RuleRegistry`, `UnknownRuleError`                              |
| [src/RbacStore.ts](src/RbacStore.ts)                 | the read-only store contract                                    |
| [src/RbacManagerStore.ts](src/RbacManagerStore.ts)   | + the mutations                                                 |
| [src/CheckAccess.ts](src/CheckAccess.ts)             | walking the hierarchy upward                                    |
| [src/RbacManager.ts](src/RbacManager.ts)             | building the data + validation                                  |
| [src/InMemoryRbacStore.ts](src/InMemoryRbacStore.ts) | a full in-memory `RbacManagerStore`                             |
| [src/snapshot.ts](src/snapshot.ts)                   | `toSnapshot` / `fromSnapshot` for the client                    |
| [src/User.ts](src/User.ts)                           | `RbacUser` — identity + a cache for checks                      |
| [src/matchRole.ts](src/matchRole.ts)                 | "this screen is for these roles", `"?"` guest / `"@"` logged in |
| [src/testing/blog.ts](src/testing/blog.ts)           | the blog fixture used by all tests                              |

## Caching in `RbacUser`

`can()` caches the result **only** when there are no `params` — with params the answer
depends on the resource and a cache would be wrong. Changing `identity` clears the cache.
Keep this behavior.

## Commands

```bash
npm run build      # src/ -> dist/
npm run dev        # tsc --watch
npm run typecheck
npm test           # vitest run
npm run lint
npm run format
```

After a change here, `rbac-db-sequelize` and `rbac-express` see it only after
`npm run build` (they resolve `rbac` to `dist/`).
