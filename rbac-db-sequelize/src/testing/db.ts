import { Sequelize } from "sequelize";

import { SequelizeRbacStore } from "../SequelizeRbacStore.js";
import { DEFAULT_TABLE_PREFIX, quoteTable, resolveTableNames } from "../tableNames.js";
import { createRbacMigrator } from "../umzug.js";

const tableNames = resolveTableNames();

/** The four data tables, children first, so a plain DROP works in order. */
const dataTables = [tableNames.assignment, tableNames.itemChild, tableNames.item, tableNames.rule];

/** Where the migrator records what it has applied. */
const metaTable = `${DEFAULT_TABLE_PREFIX}migrations`;

/**
 * Connection string for the test database, e.g.
 * `postgres://rbac:rbac@localhost:55432/rbac_test`. `docker-compose.yml` in the
 * package root brings up a matching server.
 */
export const TEST_DATABASE_URL = process.env.RBAC_DB_TEST_URL;

/**
 * Whether the suites that need PostgreSQL can run. Without a connection string
 * they are skipped rather than failed, so `npm test` still works on a machine
 * with no database.
 */
export const hasTestDatabase = Boolean(TEST_DATABASE_URL);

export function connect(): Sequelize {
  if (!TEST_DATABASE_URL) {
    throw new Error("RBAC_DB_TEST_URL is not set.");
  }
  return new Sequelize(TEST_DATABASE_URL, { logging: false });
}

/**
 * Connects and installs the schema through the umzug migrator, the same way an
 * application does. Call once per suite.
 *
 * The drop is not `migrator.down`: the suites share one database, which may
 * still hold tables from a run whose meta table no longer agrees with them, and
 * `up` over a half-existing schema fails on the indexes. A test harness wants a
 * clean slate unconditionally; `down` is covered by src/umzug.test.ts.
 */
export async function setupDatabase(): Promise<Sequelize> {
  const sequelize = connect();
  await sequelize.authenticate();
  for (const table of [...dataTables, metaTable]) {
    await sequelize.query(`DROP TABLE IF EXISTS ${quoteTable(table)} CASCADE`);
  }
  await createRbacMigrator({ sequelize }).up();
  return sequelize;
}

/** Empties the four tables, leaving the schema and the meta table alone. */
export async function resetDatabase(sequelize: Sequelize): Promise<void> {
  const tables = dataTables.map((table) => quoteTable(table)).join(", ");
  await sequelize.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
}

export function createStore(sequelize: Sequelize): SequelizeRbacStore {
  return new SequelizeRbacStore({ sequelize });
}
