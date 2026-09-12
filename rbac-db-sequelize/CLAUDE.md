# CLAUDE.md — rbac-db-sequelize

A PostgreSQL store for [`rbac`](../rbac) via Sequelize. On npm it is
`@iushev/rbac-db-sequelize`. See
[../CLAUDE.md](../CLAUDE.md) for the monorepo conventions and [README.md](README.md)
for usage.

## The contract

`SequelizeRbacStore` implements the **full** `RbacManagerStore` from `rbac` and must
behave exactly like `InMemoryRbacStore` — the two are interchangeable under the same
`RbacManager`.

The proof is [src/RbacManager.test.ts](src/RbacManager.test.ts): the `rbac` test suite
run unchanged against Postgres. If it diverges from the original in
`rbac/src/RbacManager.test.ts`, the divergence is a bug, not an adaptation.

Store-independent validation — cycles, a role under a permission — is in `RbacManager`
and is **deliberately absent here**. Don't add it.

## Injected connection only

The package never opens or closes its own `Sequelize`. The application passes a ready
connection to the constructor. Don't add code that reads `DATABASE_URL` or calls
`new Sequelize(...)` on the library path.

There are two exceptions and the list is exhaustive: [src/testing/db.ts](src/testing/db.ts)
(that's the tests) and [src/cli.ts](src/cli.ts) — the CLI has no application around it to
hand it a connection. Neither file is imported from `src/index.ts`.

`pg`, `pg-hstore` and `sequelize` are devDependencies + peer dependencies for the same
reason.

## The schema lives only in the migration

[src/migrations/](src/migrations/) is the only description of the DDL — it is created via
`QueryInterface` (`createTable`, `addConstraint`, `addIndex`), not with `sequelize.sync`
from the models, because the referential actions do real work:

- `ON UPDATE CASCADE` — renaming an item/rule propagates to the edges, the assignments
  and `rule_name`. Exactly what `InMemoryRbacStore` does by rewriting its maps.
- `ON DELETE CASCADE` — a removed item takes its edges and assignments with it.
- `ON DELETE SET NULL` — a removed rule clears `rule_name`.

So `removeItem` doesn't clean up by hand — the database does. If you touch the schema,
check that the `RbacManagerStore` contract still holds.

The four tables (prefix `rbac_` by default, names in the plural): `rules`, `items`,
`item_children`, `assignments`. Index and constraint names are derived from them, so
`resolveTableNames` is the only place where they are touched.

`rules.data` and `items.data` are `text`, not `jsonb`, and `Rule.data` / `Item.data` are
`string | null`, so `SequelizeRbacStore` writes and reads them as is — no encoding, and a
missing payload is SQL `NULL`. What the text holds is the application's business.
`rbac-db-drizzle` does the same.

The package **does not export** `createSchema` / `dropSchema`. The schema is applied via
[src/umzug.ts](src/umzug.ts) or, without a runner, with `up` from
`@iushev/rbac-db-sequelize/migrations/<file>.js`.

## Three subpaths in exports, plus one bin

[package.json](package.json) exports `.`, `./umzug` and `./migrations/*.js`. The split is
not cosmetic: `umzug` is an **optional** peer dependency and `src/index.ts` must never
import it — otherwise `import "@iushev/rbac-db-sequelize"` blows up for anyone who hasn't
installed it. That's why `createRbacMigrator` lives in a separate module, not in the index.

For the same reason [src/cli.ts](src/cli.ts) loads `./umzug.js` with a **dynamic**
`import` inside `loadCreateMigrator` — a static one would turn a missing umzug into an
incomprehensible module-resolution stack trace instead of a sentence.

`bin` is `rbac-db-sequelize-migrate -> bin/rbac-db-sequelize-migrate.js`, **not**
`dist/cli.js`, and this is the important part: npm silently skips a bin whose target file
doesn't exist at install time, and `dist/` is built afterwards. The result is a missing
`node_modules/.bin/rbac-db-sequelize-migrate` without a single warning. The committed
[bin/rbac-db-sequelize-migrate.js](bin/rbac-db-sequelize-migrate.js) is always there, loads
`dist/cli.js` dynamically and prints a readable message if the package isn't built. The
test in [src/cli.test.ts](src/cli.test.ts) guards exactly this — that `bin` doesn't point
into `dist/`.

The command stays `rbac-db-sequelize-migrate` without a scope, even though the package is
`@iushev/rbac-db-sequelize`: names in `bin` can't carry `@scope/`.

If the link is missing anyway (for example, `bin` was added after the lock file was
written), `npm rebuild` from the root creates it; `npm install` alone doesn't re-link.

Because of this file, `bin/**/*` is added to `include` in `tsconfig.eslint.json`, and
`eslint.config.js` has a block with Node globals for `bin/**/*.js` — both repeated in all
three packages so the configs stay identical.

The CLI logic (`parseArgs`, `runCommand`) is factored out and tested directly in
[src/cli.test.ts](src/cli.test.ts); `main` only wires them together and is called only from
the bin file — `src/cli.ts` has no self-execution guard. The `parseArgs` tests need no
database and run everywhere.

## Two places for the same DDL

When changing the schema you have to touch both, otherwise they diverge:

1. [src/migrations/](src/migrations/) — a new file `YYYYMMDDHHmmSS-description.ts` with
   `up`/`down` accepting `{ context: QueryInterface }` (the shape used by umzug and
   sequelize-cli), **and registration in `rbacMigrations`** in
   [src/migrations/index.ts](src/migrations/index.ts) — the list is explicit, not a glob,
   so an unregistered migration simply isn't applied. The order in the list is the order
   of application. An existing migration is **never edited** — it has been applied
   somewhere;
2. [src/models/](src/models/) — the Sequelize models, if the columns change.

The migrator writes to `<tablePrefix>migrations`, separate from the application's meta
table — the two sets of migrations are versioned independently.

## The transitive queries are CTEs

`getChildRoles`, `getPermissionsByRole` and `getPermissionsByUser` are a single
`WITH RECURSIVE` each, not a multi-query traversal. They use `UNION` (not `UNION ALL`) —
deduplication on the fly is what stops the recursion on a cycle in the hierarchy. If you
write a new transitive query, follow the same pattern.

Table names in these handwritten SQL strings go through `quoteTable` from
[src/tableNames.ts](src/tableNames.ts) — never interpolate them directly.

## The models are idempotent

`defineRbacModels` reuses a model already registered under the same name in
`sequelize.models`. The model name is the table name, so two stores with different
`tablePrefix`es coexist on one connection. See
[src/models/base.ts](src/models/base.ts).

## Tests — they need a real Postgres

Without `RBAC_DB_TEST_URL` the suites are **skipped** rather than failing, so `npm test`
works on a machine without a database. Which means a green `npm test` here means nothing if
the variable is missing — always bring the database up when you touch this package.

```bash
npm run db:up   # postgres:17-alpine on port 55432
RBAC_DB_TEST_URL=postgres://rbac:rbac@localhost:55432/rbac_test npm test
npm run db:down
```

`vitest.config.ts` has `fileParallelism: false` — all suites use the same database and must
not overlap. Don't turn it on.

The helpers are in [src/testing/db.ts](src/testing/db.ts): `hasTestDatabase`,
`setupDatabase` (once per suite), `resetDatabase` (between tests).

`setupDatabase` installs the schema via `createRbacMigrator(...).up()` — the same path the
application takes. Before that it drops the four tables **and** the meta table directly,
not via `migrator.down()`: the database is shared across suites and may hold tables from a
run whose meta table no longer matches them, and `up` on a half-existing schema blows up on
the indexes. `down` is covered by [src/umzug.test.ts](src/umzug.test.ts).

[src/umzug.test.ts](src/umzug.test.ts) and [src/cli.test.ts](src/cli.test.ts) use
separate `tablePrefix`es (`umzugtest_`, `clitest_`) and clean up after themselves, so they
don't collide with the other suites on the same database.

## Commands

```bash
npm run build      # src/ -> dist/
npm run typecheck
npm test
npm run lint
npm run format
```

A change in `../rbac` requires `npm run build -w rbac` from the root to be visible here.
