# rbac-db-sequelize

A PostgreSQL store for the [rbac](../rbac) package, via [Sequelize](https://sequelize.org/).

`rbac` defines only interfaces — `RbacStore` (reads, for access checks) and
`RbacManagerStore` (plus the mutations for building the data). This package implements the
full `RbacManagerStore` on top of Postgres, so it is interchangeable with `InMemoryRbacStore`
under the same `RbacManager`.

## Install

```bash
npm install @iushev/rbac-db-sequelize @iushev/rbac sequelize pg
npm install umzug   # optional, for the migration runner
```

`@iushev/rbac` and `sequelize` are peer dependencies — the application keeps a single copy
of each and opens the database connection itself. `umzug` is an optional peer dependency,
needed only by those who use `@iushev/rbac-db-sequelize/umzug`.

## Usage

```ts
import { RbacManager, RuleRegistry, createRole, createPermission } from "@iushev/rbac";
import { SequelizeRbacStore } from "@iushev/rbac-db-sequelize";
import { createRbacMigrator } from "@iushev/rbac-db-sequelize/umzug";
import { Sequelize } from "sequelize";

const sequelize = new Sequelize(process.env.DATABASE_URL!);

await createRbacMigrator({ sequelize }).up(); // see "Migrations" below

const store = new SequelizeRbacStore({ sequelize });
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

## Options

```ts
new SequelizeRbacStore({
  sequelize, // required; the package never opens its own connection
  tablePrefix: "rbac_", // default
  schema: undefined, // PostgreSQL schema; defaults to search_path
  transaction: undefined,
});
```

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

## Migrations

The schema is created only by the migrations — the package has no separate `createSchema`.
The recommended way is the ready-made [umzug](https://github.com/sequelize/umzug) migrator:

```bash
npm install umzug
```

```ts
import { createRbacMigrator } from "@iushev/rbac-db-sequelize/umzug";

const migrator = createRbacMigrator({ sequelize, logger: console });

await migrator.up(); // applies everything not yet applied
```

`umzug` is an **optional** peer dependency — it's pulled in only if you import
`@iushev/rbac-db-sequelize/umzug` or use the CLI. An application with a different runner
never loads it.

`createRbacMigrator` accepts the same `{ tablePrefix, schema }` as
`SequelizeRbacStore` (they must match) plus:

| Option          | Default                   | Purpose                                 |
| --------------- | ------------------------- | --------------------------------------- |
| `metaTableName` | `<tablePrefix>migrations` | the table of applied migrations         |
| `logger`        | `undefined` (silent)      | pass `console` to see what gets applied |

The meta table is deliberately separate from the application's: `rbac-db-sequelize`
migrations are versioned independently of yours. The returned object is a plain `Umzug`,
so `pending()`, `executed()` and `down()` are available too.

### CLI

The package installs `rbac-db-sequelize-migrate` (it needs a built `dist/`, i.e. when
working on the repo itself — `npm run build`):

```bash
npx rbac-db-sequelize-migrate status
npx rbac-db-sequelize-migrate migrate
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

It exits with code `1` on error, so it works in CI and in a deploy script:

```bash
DATABASE_URL=... npx rbac-db-sequelize-migrate migrate --quiet || exit 1
```

### Without umzug

Each migration is a module with `up`/`down` that accept `{ context: queryInterface }` —
the shape umzug and sequelize-cli pass — and an optional second argument
`{ tablePrefix, schema }`:

```ts
import { rbacMigrations } from "@iushev/rbac-db-sequelize/migrations/index.js";

for (const { up } of rbacMigrations) {
  await up({ context: sequelize.getQueryInterface() });
}
```

`rbacMigrations` is the full ordered list; each file can also be imported on its own, e.g.
`@iushev/rbac-db-sequelize/migrations/20260907172102-create-rbac-tables.js`. Apply all of
them — the store expects the schema the last one leaves behind. Files in
[src/migrations/](src/migrations/) are named `YYYYMMDDHHmmSS-description.ts`, so ordering
by name is also the order of application.

Called this way, `up` is not idempotent — the tables are created with `IF NOT EXISTS`,
but the indexes are not. Call it once, or call `down` before it. Through the migrator this
problem doesn't arise: the meta table remembers what has already run.

## Tests

The tests need a real PostgreSQL. Without `RBAC_DB_TEST_URL` they are skipped rather than
failing, so `npm test` works on a machine without a database.

```bash
npm run db:up   # postgres:17-alpine on port 55432
RBAC_DB_TEST_URL=postgres://rbac:rbac@localhost:55432/rbac_test npm test
npm run db:down
```

[src/RbacManager.test.ts](src/RbacManager.test.ts) is the suite from `rbac`, run unchanged
against Postgres — it passing is the proof that the two stores are interchangeable.
