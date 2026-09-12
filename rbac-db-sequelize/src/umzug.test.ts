import { QueryTypes, type Sequelize } from "sequelize";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { connect, hasTestDatabase } from "./testing/db.js";
import { createRbacMigrator } from "./umzug.js";

/** Own prefix, so the suite never touches the tables the other suites use. */
const tablePrefix = "umzugtest_";
const tables = ["rules", "items", "item_children", "assignments", "migrations"].map(
  (name) => `${tablePrefix}${name}`,
);

describe.skipIf(!hasTestDatabase)("createRbacMigrator", () => {
  const sequelize: Sequelize = hasTestDatabase ? connect() : (undefined as never);

  const migrator = () => createRbacMigrator({ sequelize, tablePrefix });

  async function existingTables(): Promise<string[]> {
    const rows = await sequelize.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE tablename IN (:tables) ORDER BY tablename`,
      { type: QueryTypes.SELECT, replacements: { tables } },
    );
    return rows.map((row) => row.tablename);
  }

  async function dropEverything(): Promise<void> {
    for (const table of tables) {
      await sequelize.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }
  }

  beforeEach(dropEverything);

  afterAll(async () => {
    await dropEverything();
    await sequelize.close();
  });

  it("reports the migration as pending before it runs", async () => {
    const pending = await migrator().pending();
    expect(pending.map((migration) => migration.name)).toEqual([
      "20260907172102-create-rbac-tables",
    ]);
  });

  it("creates the prefixed tables and records what it ran", async () => {
    const umzug = migrator();
    await umzug.up();

    expect(await existingTables()).toEqual([
      "umzugtest_assignments",
      "umzugtest_item_children",
      "umzugtest_items",
      "umzugtest_migrations",
      "umzugtest_rules",
    ]);
    expect(await umzug.executed()).toHaveLength(1);
    expect(await umzug.pending()).toEqual([]);
  });

  it("is a no-op on a second run", async () => {
    await migrator().up();
    await expect(migrator().up()).resolves.toEqual([]);
    expect(await existingTables()).toHaveLength(5);
  });

  it("drops the tables again on down, keeping the meta table", async () => {
    await migrator().up();
    await migrator().down();

    // Umzug owns the meta table; only the migration's own tables go away.
    expect(await existingTables()).toEqual(["umzugtest_migrations"]);
    expect(await migrator().executed()).toEqual([]);
  });
});
