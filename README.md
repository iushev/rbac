# rbac

Role-based access control for TypeScript following the
[NIST model](https://csrc.nist.gov/CSRC/media/Publications/conference-paper/2000/07/26/the-nist-model-for-role-based-access-control-towards-a-unified-/documents/sandhu-ferraiolo-kuhn-00.pdf)
— Core + Hierarchical RBAC with rules. A core with no runtime dependencies, PostgreSQL
stores, and adapters for Express, TanStack Start and React.

## Packages

| Package                                           | What it does                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| [`@iushev/rbac`](rbac/)                           | the core — roles, permissions, rules, access checks                   |
| [`@iushev/rbac-db-sequelize`](rbac-db-sequelize/) | PostgreSQL store via Sequelize                                        |
| [`@iushev/rbac-db-drizzle`](rbac-db-drizzle/)     | PostgreSQL store via Drizzle ORM                                      |
| [`@iushev/rbac-express`](rbac-express/)           | Express 5 middleware and per-route guards                             |
| [`@iushev/rbac-tanstack`](rbac-tanstack/)         | TanStack Start — server function guards and the bridge to the browser |
| [`@iushev/rbac-react`](rbac-react/)               | React provider, hooks and `<Can>` / `<Access>` for the UI             |

Each package has its own README covering installation and usage.

## What to install

The core is always required. On top of it — one store and the adapters for your framework:

```bash
# Express + React
npm install @iushev/rbac @iushev/rbac-express @iushev/rbac-react

# TanStack Start
npm install @iushev/rbac @iushev/rbac-tanstack @iushev/rbac-react

# store — one of the two
npm install @iushev/rbac-db-sequelize sequelize pg
npm install @iushev/rbac-db-drizzle drizzle-orm pg
```

The two stores are interchangeable: the same schema, the same behavior, a different
ORM — pick whichever one your application already uses. For tests and prototypes the
core ships `InMemoryRbacStore`, no database needed.

A check in the UI only hides interface. A hidden button is not protection — `rbac-react`
never replaces the server-side guard (`rbac-express` or `rbac-tanstack`).

## Examples

The same application — a small blog with `reader`, `author` and `admin` roles and a
"you can only edit your own posts" rule — on two stacks. Read them together:

- [examples/express-react/](examples/express-react/) — guards on Express routes, a
  separate React UI.
- [examples/tanstack-start/](examples/tanstack-start/) — guards on server functions,
  SSR.

The examples are not part of the workspaces and are run separately:

```bash
cd examples/express-react
npm install
npm run dev
```

## Development

Node.js 20+ is required. The repo is an npm workspaces monorepo; commands run from the
root go through all packages:

```bash
npm install
npm run build        # tsc in every package
npm run typecheck
npm test             # vitest
npm run lint
npm run format
```

For a single package: `npm run test -w rbac-express`.

The other packages see the core through `rbac/dist`, not `rbac/src`. After changing the
core, run `npm run build -w rbac`, otherwise the other packages and the examples test
the old version.

The `rbac-db-sequelize` and `rbac-db-drizzle` tests need a real PostgreSQL and are
skipped when `RBAC_DB_TEST_URL` is not set — see their READMEs.

### Versions

The packages are versioned together — they are always on the same version:

```bash
npm run release:version -- 2.1.0 --dry-run   # what will change
npm run release:version -- 2.1.0             # or major | minor | patch
```

The script updates the version of every package, the ranges of the `@iushev/*`
dependencies between them, and the lock files. It does not commit or tag.

## License

MIT
