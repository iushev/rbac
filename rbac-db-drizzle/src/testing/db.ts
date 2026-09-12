import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { RbacDatabase } from "../database.js";
import { DrizzleRbacStore } from "../DrizzleRbacStore.js";
import { createRbacMigrator } from "../migrator.js";
import { DEFAULT_TABLE_PREFIX, resolveTableNames, tableRef } from "../tableNames.js";

const tableNames = resolveTableNames();

/** The four data tables, children first, so a plain DROP works in order. */
const dataTables = [tableNames.assignment, tableNames.itemChild, tableNames.item, tableNames.rule];

/** Where the migrator records what it has applied. */
const metaTable = `${DEFAULT_TABLE_PREFIX}migrations`;

/**
 * Connection string for the test database, e.g.
 * `postgres://rbac:rbac@localhost:55433/rbac_test`. `docker-compose.yml` in the
 * package root brings up a matching server.
 */
export const TEST_DATABASE_URL = process.env.RBAC_DB_TEST_URL;

/**
 * Whether the suites that need PostgreSQL can run. Without a connection string
 * they are skipped rather than failed, so `npm test` still works on a machine
 * with no database.
 */
export const hasTestDatabase = Boolean(TEST_DATABASE_URL);

/**
 * A Drizzle handle plus the pool behind it: the package never opens a
 * connection, so the tests own the pool and have to close it themselves.
 */
export interface TestConnection {
  db: RbacDatabase;
  close: () => Promise<void>;
}

export function connect(): TestConnection {
  if (!TEST_DATABASE_URL) {
    throw new Error("RBAC_DB_TEST_URL is not set.");
  }
  const pool = new Pool({ connectionString: TEST_DATABASE_URL });
  return { db: drizzle(pool), close: () => pool.end() };
}

/**
 * Connects and installs the schema through the migrator, the same way an
 * application does. Call once per suite.
 *
 * The drop is not `migrator.down`: the suites share one database, which may
 * still hold tables from a run whose meta table no longer agrees with them, and
 * `up` over a half-existing schema fails on the indexes. A test harness wants a
 * clean slate unconditionally; `down` is covered by src/migrator.test.ts.
 */
export async function setupDatabase(): Promise<TestConnection> {
  const connection = connect();
  for (const table of [...dataTables, metaTable]) {
    await connection.db.execute(sql`DROP TABLE IF EXISTS ${tableRef(table)} CASCADE`);
  }
  await createRbacMigrator({ db: connection.db }).up();
  return connection;
}

/** Empties the four tables, leaving the schema and the meta table alone. */
export async function resetDatabase(connection: TestConnection): Promise<void> {
  const tables = sql.join(
    dataTables.map((table) => tableRef(table)),
    sql`, `,
  );
  await connection.db.execute(sql`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
}

export function createStore(connection: TestConnection): DrizzleRbacStore {
  return new DrizzleRbacStore({ db: connection.db });
}
