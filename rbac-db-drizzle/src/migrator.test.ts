import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createRbacMigrator } from "./migrator.js";
import { connect, hasTestDatabase, type TestConnection } from "./testing/db.js";
import { tableRef } from "./tableNames.js";

/** Own prefix, so the suite never touches the tables the other suites use. */
const tablePrefix = "migratortest_";
const tables = ["rules", "items", "item_children", "assignments", "migrations"].map(
  (name) => `${tablePrefix}${name}`,
);
const migration = "20260908183000-create-rbac-tables";

describe.skipIf(!hasTestDatabase)("createRbacMigrator", () => {
  const connection: TestConnection = hasTestDatabase ? connect() : (undefined as never);

  const migrator = () => createRbacMigrator({ db: connection.db, tablePrefix });

  async function existingTables(): Promise<string[]> {
    const result = await connection.db.execute<{ tablename: string }>(
      // sql.param keeps the array one bound value; interpolating it bare would
      // expand it into a parameter list instead.
      sql`SELECT tablename FROM pg_tables
           WHERE tablename = ANY(${sql.param(tables)}) ORDER BY tablename`,
    );
    return result.rows.map((row) => row.tablename);
  }

  async function dropEverything(): Promise<void> {
    for (const table of tables) {
      await connection.db.execute(sql`DROP TABLE IF EXISTS ${tableRef(table)} CASCADE`);
    }
  }

  beforeEach(dropEverything);

  afterAll(async () => {
    await dropEverything();
    await connection.close();
  });

  it("reports the migration as pending before it runs", async () => {
    const pending = await migrator().pending();
    expect(pending.map((meta) => meta.name)).toEqual([migration]);
  });

  it("creates the prefixed tables and records what it ran", async () => {
    const runner = migrator();
    await runner.up();

    expect(await existingTables()).toEqual([
      "migratortest_assignments",
      "migratortest_item_children",
      "migratortest_items",
      "migratortest_migrations",
      "migratortest_rules",
    ]);
    expect(await runner.executed()).toHaveLength(1);
    expect(await runner.pending()).toEqual([]);
  });

  it("is a no-op on a second run", async () => {
    await migrator().up();
    await expect(migrator().up()).resolves.toEqual([]);
    expect(await existingTables()).toHaveLength(5);
  });

  it("drops the tables again on down, keeping the meta table", async () => {
    await migrator().up();
    await migrator().down();

    // The migrator owns the meta table; only the migration's own tables go away.
    expect(await existingTables()).toEqual(["migratortest_migrations"]);
    expect(await migrator().executed()).toEqual([]);
  });

  it("creates the meta table on the first read, before anything is applied", async () => {
    await migrator().pending();

    expect(await existingTables()).toEqual(["migratortest_migrations"]);
  });

  it("rolls the migration back when it fails halfway", async () => {
    // A table already sitting where the migration wants to create one: the
    // CREATE fails, and neither the earlier tables nor a meta row may survive.
    await connection.db.execute(sql`CREATE TABLE ${tableRef(`${tablePrefix}items`)} ("x" int)`);

    await expect(migrator().up()).rejects.toThrow();

    expect(await existingTables()).toEqual(["migratortest_items", "migratortest_migrations"]);
    expect(await migrator().executed()).toEqual([]);
  });
});
