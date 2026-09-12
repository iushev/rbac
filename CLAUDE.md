# CLAUDE.md

Guidance for Claude Code when working in this monorepo.

## What this is

An npm workspaces monorepo with six publishable packages for RBAC following the NIST model
(Core + Hierarchical RBAC with rules):

| Package                                  | Role                                                                  |
| ---------------------------------------- | --------------------------------------------------------------------- |
| [rbac/](rbac/)                           | the core — types, interfaces, access checks. No runtime dependencies. |
| [rbac-db-sequelize/](rbac-db-sequelize/) | PostgreSQL store via Sequelize                                        |
| [rbac-db-drizzle/](rbac-db-drizzle/)     | PostgreSQL store via Drizzle ORM                                      |
| [rbac-express/](rbac-express/)           | Express 5 middleware and guards                                       |
| [rbac-tanstack/](rbac-tanstack/)         | TanStack Start — server function guards and the bridge to the browser |
| [rbac-react/](rbac-react/)               | React provider, hooks and components for access control in the UI     |

Each package has its own CLAUDE.md with its details — read it before touching its code.

On npm all packages live under the `@iushev/` scope: the `rbac` directory is `@iushev/rbac`,
`rbac-express` is `@iushev/rbac-express`, and so on. Imports use the npm name, while `-w`
also accepts the directory, which is why `npm run test -w rbac-db-drizzle` works.

## Dependencies between packages

`rbac` (on npm: `@iushev/rbac`) is a peer dependency of the other five and resolves through
the symlink `node_modules/@iushev/rbac -> ../../rbac`, i.e. to **`rbac/dist`**, not to
`rbac/src`.

A consequence that bites often: a change in `rbac/src` is not visible to `rbac-db-sequelize`,
`rbac-db-drizzle`, `rbac-express`, `rbac-tanstack` and `rbac-react` (neither in `npm test`
nor in `typecheck`) until `rbac` is compiled. After a change in the core:

```bash
npm run build -w rbac
```

or simply `npm run build` from the root (workspaces are built in the order from
`package.json`, which is topologically correct).

`rbac-db-sequelize`, `rbac-db-drizzle`, `rbac-express` and `rbac-react` do not depend on each
other and must never start to. The only exception is `rbac-tanstack`: it imports
`rbac-react` because it assembles `<RbacProvider>` from the session, and so it comes
**after** it in `workspaces`.

`rbac-express`, `rbac-tanstack` and `rbac-react` are the adapters — the first two for the
server, the third for the UI. `rbac-react` hides interface, the other two protect what it
hides; a hidden button is not protection, so a UI check never replaces a server guard.

`rbac-express` and `rbac-tanstack` are a pair, like the DB packages: the same 401 / 403
distinction, the same names `can` and `access`, the same role for `getIdentity`, a different
framework. A change in guard behavior is considered for both.

The two DB packages are twins: the same schema, the same behavior, a different ORM. The
application picks one. A change in store behavior is made in both.

## Examples

[examples/express-react/](examples/express-react/) is a blog where `rbac-express` and
`rbac-react` work over the same graph — guards on routes, `<Can>` and `<Access>` in the
UI, `rbacController` under `access(["admin"])`. Like the packages, it has its own
[CLAUDE.md](examples/express-react/CLAUDE.md).

[examples/tanstack-start/](examples/tanstack-start/) is the same blog on TanStack Start
over `rbac-tanstack` and `rbac-react`: the same graph and the same rules, but without
Express — the guard protects server functions rather than routes, and the app is SSR. It
has its own [CLAUDE.md](examples/tanstack-start/CLAUDE.md) too.

The two examples are the same application and are read together: a change to the graph,
the rules or the demo users in one is made in the other too, otherwise the comparison
stops working.

The examples are **not workspaces**: each has its own `package.json` and its own
`npm install`, and the packages are pulled in via `file:../../<package>`. So the root
commands (`npm test`, `npm run build`) don't touch them, and a change in the core reaches
an example only after `npm run build -w rbac`, just as with the other packages.

## Commands (from the root, run across all workspaces)

```bash
npm run build        # tsc in every package
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npm run lint         # eslint (typed rules)
npm run format       # prettier --write
npm run format:check
npm run clean        # rm -rf dist
```

For a single package: `npm run test -w rbac-db-sequelize`.

The `rbac-db-sequelize` and `rbac-db-drizzle` tests need a real PostgreSQL and are
**skipped** without `RBAC_DB_TEST_URL` — see [rbac-db-sequelize/CLAUDE.md](rbac-db-sequelize/CLAUDE.md)
and [rbac-db-drizzle/CLAUDE.md](rbac-db-drizzle/CLAUDE.md). A green `npm test`
from the root does not mean the DB layer was tested.

## Versions

The six packages are versioned together — always on the same version. Changing it goes
through [scripts/set-version.mjs](scripts/set-version.mjs):

```bash
npm run release:version -- 2.1.0            # exact version
npm run release:version -- minor            # major | minor | patch from the shared version
npm run release:version -- 2.1.0 --dry-run  # only shows what would change
```

The script sets the version in every package, points the `@iushev/*` dependencies between
them (peer and dev) at `^<version>`, and updates `package-lock.json` in the root and in the
examples. It does not commit or tag — you do that yourself.

Don't use `npm version <v> --workspaces` on its own: it changes the `version` field but not
the ranges in the sibling packages. On `0.x` this breaks immediately — `^0.1.0` does not
accept `0.2.0`, so `rbac-tanstack` is left with an unsatisfied peer on `rbac-react`.

## Conventions shared by the five packages

- **ESM + NodeNext.** All relative imports end in `.js`, even when they point to a `.ts`
  file. `verbatimModuleSyntax` is on: `import type` for types.
- **Strict TypeScript** — `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`.
- **The public API goes through `src/index.ts`.** A new export is added there too.
- **Tests live next to the code**: `src/X.ts` ↔ `src/X.test.ts`. Vitest,
  `include: src/**/*.test.ts`.
- `src/testing/` holds test fixtures — excluded from the build (`tsconfig.json`) and not
  published.
- `eslint.config.js`, `.prettierrc.json`, `tsconfig.json` and `tsconfig.eslint.json` are
  identical across all packages. A change in one usually has to be repeated in the other
  four. The exception is `rbac-react`: its `tsconfig.json` adds `jsx` and the DOM libs, and
  its tests are `.tsx`.
- Prettier: double quotes, semicolons, `printWidth: 120`.

## Language and writing style

Everything is in **English**: READMEs, documentation prose, code, names and JSDoc comments.
Write new text the same way.

Code comments explain _why_, not _what_ — see the existing ones. Don't add comments that
retell the line below them.

## Where each piece of logic lives

A rule that applies everywhere: store-independent validation — cycle detection, the ban on
a role under a permission, auto-creating a placeholder rule — lives in `RbacManager`
(package `rbac`) and is **not repeated** in store implementations. If you're adding such a
check in `rbac-db-sequelize` or `rbac-db-drizzle`, it almost certainly belongs in
`RbacManager`.

Conversely: `InMemoryRbacStore`, `SequelizeRbacStore` and `DrizzleRbacStore` must be
interchangeable. `rbac-db-sequelize/src/RbacManager.test.ts` and
`rbac-db-drizzle/src/RbacManager.test.ts` are the `rbac` test suite run unchanged against
Postgres — they are the proof. If you change a store's behavior, change it in all of them.
