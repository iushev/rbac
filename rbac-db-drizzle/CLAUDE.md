# CLAUDE.md — rbac-db-drizzle

A PostgreSQL store for [`rbac`](../rbac) via Drizzle ORM. On npm it is
`@iushev/rbac-db-drizzle`. See
[../CLAUDE.md](../CLAUDE.md) for the monorepo conventions and [README.md](README.md)
for usage.

The package is a twin of [`rbac-db-sequelize`](../rbac-db-sequelize) — the same four
tables, the same column names, the same behavior. A change in one almost always means
touching the other; a divergence between them is a bug, not a freedom.

## The contract

`DrizzleRbacStore` implements the **full** `RbacManagerStore` from `rbac` and must behave
exactly like `InMemoryRbacStore` — the two are interchangeable under the same
`RbacManager`.

The proof is [src/RbacManager.test.ts](src/RbacManager.test.ts): the `rbac` test suite
run unchanged against Postgres. If it diverges from the original in
`rbac/src/RbacManager.test.ts`, the divergence is a bug, not an adaptation.

Store-independent validation — cycles, a role under a permission — is in `RbacManager`
and is **deliberately absent here**. Don't add it.

## Injected connection only

The package never opens or closes its own pool. The application passes a ready Drizzle
handle to the constructor. Don't add code that reads `DATABASE_URL` or calls
`new Pool(...)` on the library path.

There are two exceptions and the list is exhaustive: [src/testing/db.ts](src/testing/db.ts)
(that's the tests) and [src/cli.ts](src/cli.ts) — the CLI has no application around it to
hand it a connection. Neither file is imported from `src/index.ts`.

`pg` is a devDependency + an **optional** peer dependency for the same reason.

## `RbacDatabase` is an Omit, and that's not laziness

[src/database.ts](src/database.ts) types the handle as
`Omit<PgDatabase<...>, "query" | "_">`. The two removed properties depend on the
application's Drizzle schema: `PgDatabase.query` is a conditional type that is
`DrizzleTypeError` when there is no schema and a map of query builders when there is one.
Leave them in, and `drizzle(pool)` without a schema and `drizzle(pool, { schema })` can't
both be valid for the same parameter. It's been tried — it doesn't work.

This type also covers `PgTransaction`, because a transaction is a `PgDatabase`. That's why
`DrizzleRbacStoreOptions` has no separate `transaction` field, unlike
`rbac-db-sequelize`.

`withTransaction` detects whether it's already inside a transaction via
`is(this.db, PgTransaction)`, not via a constructor flag.

## The schema: columns here, DDL only in the migration

[src/schema.ts](src/schema.ts) is a factory, `createRbacSchema(options)`, rather than four
`pgTable` constants, because the names depend on `tablePrefix` and `schema`. Hence the
absence of `drizzle-kit`: it needs the names at build time, whereas here they are only
known at runtime. **Don't add a `drizzle-kit` config or a `drizzle/` folder** — it would
describe only the default prefix and immediately diverge from the migration.

`tableFactory` picks between `pgTable` and `pgSchema(name).table` with a cast. The cast is
needed because the two have the same signature but different nominal types; at runtime the
schema is carried by the table object in both cases.

`schema.ts` contains **only columns**. The foreign keys, the indexes and the check
constraint are in [src/migrations/](src/migrations/) and nowhere else — they are not
decoration, they are what the store relies on instead of cascading by hand:

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
`string | null`, so `DrizzleRbacStore` writes and reads them as is — no encoding, and a
missing payload is SQL `NULL`. What the text holds is the application's business.
`rbac-db-sequelize` does the same.

## Our own migrator, not drizzle-kit

[src/migrator.ts](src/migrator.ts) is a handwritten runner over the list in
[src/migrations/index.ts](src/migrations/index.ts). The API (`pending`, `executed`,
`up`, `down`) deliberately mimics umzug, which `rbac-db-sequelize` uses, so deploy scripts
don't have to be rewritten when swapping one package for the other.

Each migration runs in its own transaction together with its row in the meta table —
PostgreSQL executes DDL transactionally, so a failure midway leaves neither half a schema
nor a record that it ran. The test for this is in
[src/migrator.test.ts](src/migrator.test.ts).

`executed()` and `down()` order by the order of `rbacMigrations`, not by what the meta
table says, so that `down` is the exact reverse of `up`.

The migrator writes to `<tablePrefix>migrations`, separate from the application's meta
table — the two sets of migrations are versioned independently.

## A new migration

A new file `YYYYMMDDHHmmSS-description.ts` in [src/migrations/](src/migrations/) with
`up`/`down` accepting `{ context: RbacDatabase }` (umzug's shape, for symmetry with the
sibling package), **and registration in `rbacMigrations`** in
[src/migrations/index.ts](src/migrations/index.ts) — the list is explicit, not a glob, so
an unregistered migration simply isn't applied. The order in the list is the order of
application. An existing migration is **never edited** — it has been applied somewhere.

If columns change, touch [src/schema.ts](src/schema.ts) too, otherwise the two diverge.

DDL is written as an `sql` template. Table names are interpolated via the table objects
themselves (`${item}`), and index and constraint names via `sql.identifier(...)`. Never
interpolate a name directly into the string.

## The transitive queries are CTEs

`getChildRoles`, `getPermissionsByRole` and `getPermissionsByUser` are a single
`WITH RECURSIVE` each, via `db.execute`, not a multi-query traversal. They use `UNION`
(not `UNION ALL`) — deduplication on the fly is what stops the recursion on a cycle in the
hierarchy. If you write a new transitive query, follow the same pattern.

Drizzle 0.45 has no `withRecursive`; `$with` only builds non-recursive CTEs. Hence the raw
SQL.

Rows from `db.execute` come back with the **database column names** (`rule_name`), not the
names from schema.ts (`ruleName`) — hence the two converters, `toItem` and `rawToItem`.

Everything else goes through the query builder. `neighbours` is an `inArray` with a
subquery rather than a join, so that the result type stays a single table's row; the effect
is the same — edges whose other end no longer has an item drop out, as in
`InMemoryRbacStore.resolve`.

## Arrays in an `sql` template

A bare array in an `sql` template expands into a list of parameters `($1, $2, ...)`, not
into a single array parameter. For `= ANY(...)` you need `sql.param(tables)`. It bites
exactly once, in [src/migrator.test.ts](src/migrator.test.ts).

## One bin, three subpaths in exports

[package.json](package.json) exports `.`, `./migrator` and `./migrations/*.js`.
`createRbacMigrator` is kept out of the index so it doesn't drag the DDL into the
application's runtime path.

`bin` is `rbac-db-drizzle-migrate -> bin/rbac-db-drizzle-migrate.js`, **not**
`dist/cli.js`, and this is the important part: npm silently skips a bin whose target file
doesn't exist at install time, and `dist/` is built afterwards. The result is a missing
`node_modules/.bin/rbac-db-drizzle-migrate` without a single warning. The committed
[bin/rbac-db-drizzle-migrate.js](bin/rbac-db-drizzle-migrate.js) is always there, loads
`dist/cli.js` dynamically and prints a readable message if the package isn't built. The
test in [src/cli.test.ts](src/cli.test.ts) guards exactly this — that `bin` doesn't point
into `dist/`.

The command stays `rbac-db-drizzle-migrate` without a scope, even though the package is
`@iushev/rbac-db-drizzle`: names in `bin` can't carry `@scope/`.

If the link is missing anyway (for example, `bin` was added after the lock file was
written), `npm rebuild` from the root creates it; `npm install` alone doesn't re-link.

Because of this file, `bin/**/*` is added to `include` in `tsconfig.eslint.json`, and
`eslint.config.js` has a block with Node globals for `bin/**/*.js` — both repeated in all
packages so the configs stay identical.

[src/cli.ts](src/cli.ts) loads `pg` and `drizzle-orm/node-postgres` with a **dynamic**
`import` inside `connect` — a static one would turn a missing `pg` into an incomprehensible
module-resolution stack trace instead of a sentence. The second one is dynamic too, because
`drizzle-orm/node-postgres` itself imports `pg` at module level.

The CLI logic (`parseArgs`, `runCommand`) is factored out and tested directly in
[src/cli.test.ts](src/cli.test.ts); `main` only wires them together and is called only from
the bin file — `src/cli.ts` has no self-execution guard. The `parseArgs` tests need no
database and run everywhere.

## Tests — they need a real Postgres

Without `RBAC_DB_TEST_URL` the suites are **skipped** rather than failing, so `npm test`
works on a machine without a database. Which means a green `npm test` here means nothing if
the variable is missing — always bring the database up when you touch this package.

```bash
npm run db:up   # postgres:17-alpine on port 55433
RBAC_DB_TEST_URL=postgres://rbac:rbac@localhost:55433/rbac_test npm test
npm run db:down
```

The port is 55433, not 55432 as in `rbac-db-sequelize`, so both databases can be up at the
same time.

`vitest.config.ts` has `fileParallelism: false` — all suites use the same database and must
not overlap. Don't turn it on.

The helpers are in [src/testing/db.ts](src/testing/db.ts): `hasTestDatabase`,
`setupDatabase` (once per suite), `resetDatabase` (between tests). `TestConnection` also
carries `close`, because the pool belongs to the tests — the package doesn't close
connections.

`setupDatabase` installs the schema via `createRbacMigrator(...).up()` — the same path the
application takes. Before that it drops the four tables **and** the meta table directly,
not via `migrator.down()`: the database is shared across suites and may hold tables from a
run whose meta table no longer matches them, and `up` on a half-existing schema blows up.
`down` is covered by [src/migrator.test.ts](src/migrator.test.ts).

[src/migrator.test.ts](src/migrator.test.ts) and [src/cli.test.ts](src/cli.test.ts) use
separate `tablePrefix`es (`migratortest_`, `clitest_`) and clean up after themselves, so
they don't collide with the other suites on the same database.

## Commands

```bash
npm run build      # src/ -> dist/
npm run typecheck
npm test
npm run lint
npm run format
```

A change in `../rbac` requires `npm run build -w rbac` from the root to be visible here.
