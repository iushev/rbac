# rbac-db-drizzle

A PostgreSQL store for the [rbac](../rbac) package, via [Drizzle ORM](https://orm.drizzle.team/).

`rbac` defines only interfaces — `RbacStore` (reads, for access checks) and
`RbacManagerStore` (plus the mutations for building the data). This package implements the
full `RbacManagerStore` on top of Postgres, so it is interchangeable with `InMemoryRbacStore`
under the same `RbacManager`.

[rbac-db-sequelize](../rbac-db-sequelize) fulfills the same contract — the tables, the
column names and the behavior match one to one, so choosing between the two packages is
purely a matter of which ORM the application uses.

## Install

```bash
npm install @iushev/rbac-db-drizzle @iushev/rbac drizzle-orm pg
```

`@iushev/rbac` and `drizzle-orm` are peer dependencies — the application keeps a single copy
of each and opens the database connection itself. `pg` is an optional peer dependency, needed
only by the CLI, which is the only place in the package that opens its own connection.

## Usage

```ts
import { RbacManager, RuleRegistry, createRole, createPermission } from "@iushev/rbac";
import { DrizzleRbacStore } from "@iushev/rbac-db-drizzle";
import { createRbacMigrator } from "@iushev/rbac-db-drizzle/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

await createRbacMigrator({ db }).up(); // see "Migrations" below

const store = new DrizzleRbacStore({ db });
const rules = new RuleRegistry({
  isAuthor: ({ username, params }) => (params.post as Post).authorId === username,
});
const manager = new RbacManager({ store, rules });

const viewPost = createPermission({ name: "viewPost" });
const reader = createRole({ name: "reader" });

await manager.add(viewPost);
await manager.add(reader);
await manager.addChild(reader, viewPost);
await manager.assign(reader, "alice");

await manager.checkAccess({ username: "alice", itemName: "viewPost" }); // true
```

Client-side access checks stay unchanged: the server provides a snapshot via
`manager.getRbac()` / `toSnapshot`, and the client loads it into `InMemoryRbacStore`.

`db` is the application's own — with or without its own Drizzle schema, it doesn't matter.
The package uses only the SQL builders and `execute`, never the relational query API, and so
it doesn't need to know anything about the other tables.

## Options

```ts
new DrizzleRbacStore({
  db, // required; the package never opens its own connection
  tablePrefix: "rbac_", // default
  schema: undefined, // PostgreSQL schema; defaults to search_path
});
```

A transaction is passed in place of `db` — `PgTransaction` is a `PgDatabase`, so
`new DrizzleRbacStore({ db: tx })` works. `withTransaction` is more convenient.

## Transactions

`withTransaction` binds the store to a transaction, commits it on success and rolls it back
on error:

```ts
await store.withTransaction(async (tx) => {
  const manager = new RbacManager({ store: tx, rules });
  await manager.add(role);
  await manager.assign(role, "alice");
});
```

A store that is already bound to a transaction runs the function directly instead of
opening a savepoint nobody asked for.

## Schema

Four tables (prefixed with `rbac_` by default):

| Table                | Contents                                                                            |
| -------------------- | ----------------------------------------------------------------------------------- |
| `rbac_rules`         | `name` PK, `data` text                                                              |
| `rbac_items`         | `name` PK, `type` (`role`/`permission`), `description`, `rule_name` FK, `data` text |
| `rbac_item_children` | `parent_name`, `child_name` — the hierarchy edges, PK on the pair                   |
| `rbac_assignments`   | `username`, `item_name` FK, `created_at` timestamptz                                |

The referential actions do real work; they are not decoration:

- `ON UPDATE CASCADE` makes renaming an item or rule propagate automatically to the edges,
  the assignments and `rule_name`.
- `ON DELETE CASCADE` deletes the edges and assignments of a removed item.
- `ON DELETE SET NULL` clears `rule_name` when a rule is removed.

The transitive queries (`getChildRoles`, `getPermissionsByRole`, `getPermissionsByUser`)
are a single `WITH RECURSIVE` CTE each instead of a multi-query traversal. `UNION` (not
`UNION ALL`) deduplicates on the fly, so a cycle in the hierarchy terminates the recursion
instead of spinning it forever.

Store-independent validation — cycle detection and rejecting a role under a permission —
lives in `RbacManager` and is deliberately not repeated here.

### The Drizzle definitions

`createRbacSchema({ tablePrefix, schema })` returns the four `pgTable` objects, if you need
them in your own queries:

```ts
import { createRbacSchema } from "@iushev/rbac-db-drizzle";

const { item, assignment } = createRbacSchema();
const rows = await db.select().from(item);
```

It is a factory rather than four module-level constants, because the names depend on
`tablePrefix` and `schema`, which the application chooses. For the same reason the package
has no `drizzle-kit` setup: generating DDL needs the names at build time, whereas here they
are only known at runtime. The DDL is handwritten and lives only in the migrations.

## Migrations

The schema is created only by the migrations — the package has no separate `createSchema`.

```ts
import { createRbacMigrator } from "@iushev/rbac-db-drizzle/migrator";

const migrator = createRbacMigrator({ db, logger: console });

await migrator.up(); // applies everything not yet applied
```

`createRbacMigrator` accepts the same `{ tablePrefix, schema }` as `DrizzleRbacStore`
(they must match) plus:

| Option          | Default                   | Purpose                                 |
| --------------- | ------------------------- | --------------------------------------- |
| `metaTableName` | `<tablePrefix>migrations` | the table of applied migrations         |
| `logger`        | `undefined` (silent)      | pass `console` to see what gets applied |

The meta table is deliberately separate from the application's: `rbac-db-drizzle`
migrations are versioned independently of yours. Besides `up()`, `pending()`, `executed()`
and `down()` are available too — the API deliberately uses the same names as umzug, which
`rbac-db-sequelize` uses, so deploy scripts don't have to be rewritten when swapping one
package for the other.

Each migration runs in its own transaction together with its row in the meta table.
PostgreSQL executes DDL transactionally, so a failure midway leaves neither half a schema
nor a record that the migration ran.

### CLI

The package installs `rbac-db-drizzle-migrate` (it needs a built `dist/`, i.e. when working
on the repo itself — `npm run build`):

```bash
npx rbac-db-drizzle-migrate status
npx rbac-db-drizzle-migrate migrate
```

| Command        | What it does                                     |
| -------------- | ------------------------------------------------ |
| `status`       | current, applied and pending migrations, as JSON |
| `migrate`      | applies everything not yet applied               |
| `migrate-next` | applies only the next pending one                |
| `migrate-prev` | reverts the last applied one                     |
| `migrate-down` | reverts all applied ones                         |

| Option                | Env                                | Default                   |
| --------------------- | ---------------------------------- | ------------------------- |
| `--url <url>`         | `RBAC_DB_URL`, then `DATABASE_URL` | —                         |
| `--table-prefix <p>`  | `RBAC_DB_TABLE_PREFIX`             | `rbac_`                   |
| `--schema <name>`     | `RBAC_DB_SCHEMA`                   | search\_path              |
| `--meta-table <name>` | —                                  | `<tablePrefix>migrations` |
| `--quiet`             | —                                  | off                       |

The CLI is the only place in the package that opens its own connection, and so it is also
the only one that needs `pg`. It exits with code `1` on error, so it works in CI and in a
deploy script:

```bash
DATABASE_URL=... npx rbac-db-drizzle-migrate migrate --quiet || exit 1
```

### Without the migrator

Each migration is a module with `up`/`down` that accept `{ context: db }` — the same shape
the migrator passes — and an optional second argument `{ tablePrefix, schema }`:

```ts
import { rbacMigrations } from "@iushev/rbac-db-drizzle/migrations/index.js";

for (const { up } of rbacMigrations) {
  await up({ context: db });
}
```

`rbacMigrations` is the full ordered list; each file can also be imported on its own, e.g.
`@iushev/rbac-db-drizzle/migrations/20260908183000-create-rbac-tables.js`. Apply all of
them — the store expects the schema the last one leaves behind. Files in
[src/migrations/](src/migrations/) are named `YYYYMMDDHHmmSS-description.ts`, so ordering
by name is also the order of application.

Called this way, `up` is not idempotent — `CREATE TABLE` has no `IF NOT EXISTS`, so that an
existing schema can't silently diverge from the expected one. Call it once, or call `down`
before it. Through the migrator this problem doesn't arise: the meta table remembers what
has already run.

## Tests

The tests need a real PostgreSQL. Without `RBAC_DB_TEST_URL` they are skipped rather than
failing, so `npm test` works on a machine without a database.

```bash
npm run db:up   # postgres:17-alpine on port 55433
RBAC_DB_TEST_URL=postgres://rbac:rbac@localhost:55433/rbac_test npm test
npm run db:down
```

[src/RbacManager.test.ts](src/RbacManager.test.ts) is the suite from `rbac`, run unchanged
against Postgres — it passing is the proof that the two stores are interchangeable.
