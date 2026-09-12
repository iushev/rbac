import { sql } from "drizzle-orm";

import type { RbacDatabase } from "./database.js";
import { rbacMigrations, type RbacMigration } from "./migrations/index.js";
import { DEFAULT_TABLE_PREFIX, tableRef, type RbacSchemaOptions } from "./tableNames.js";

/**
 * Logger shape, borrowed from umzug so the two are interchangeable in an
 * application's scripts. `console` satisfies it; leaving it out keeps the
 * migrator quiet, which is the default — a library should not write to the
 * app's stdout.
 */
export type RbacMigratorLogger = Record<
  "info" | "warn" | "error" | "debug",
  (message: Record<string, unknown>) => void
>;

export interface RbacMigratorOptions extends RbacSchemaOptions {
  /** The Drizzle handle to migrate. As everywhere else, the application owns it. */
  db: RbacDatabase;
  /**
   * Table recording which migrations ran. Defaults to `<tablePrefix>migrations`,
   * deliberately separate from the application's own meta table — the two sets
   * of migrations are versioned independently.
   */
  metaTableName?: string;
  /** Pass `console` to see what is applied. Silent by default. */
  logger?: RbacMigratorLogger;
}

/** What the migrator reports about a migration. */
export interface RbacMigrationMeta {
  name: string;
}

export interface RbacMigrateOptions {
  /** Apply at most this many migrations. Defaults to all of them. */
  step?: number;
}

export interface RbacRevertOptions {
  /** Revert at most this many migrations. Defaults to one, as in umzug. */
  step?: number;
  /** `0` reverts everything, whatever `step` says. */
  to?: 0;
}

/**
 * Runs this package's migrations and records what it applied.
 *
 * Hand-rolled rather than `drizzle-kit`: the table names depend on
 * `tablePrefix` and `schema`, which are only known at run time, and generating
 * SQL needs them at build time. It is also why `drizzle-kit` is not a
 * dependency of this package at all.
 *
 * The umzug-shaped API (`pending`, `executed`, `up`, `down`) is deliberate —
 * `rbac-db-sequelize` exposes the real thing, and application scripts should not
 * have to be rewritten when swapping one storage package for the other.
 */
export class RbacMigrator {
  private readonly db: RbacDatabase;
  private readonly schemaOptions: RbacSchemaOptions;
  private readonly logger: RbacMigratorLogger | undefined;
  /** Quoted, schema-qualified meta table name; it has no Drizzle definition. */
  private readonly metaTable;

  constructor(options: RbacMigratorOptions) {
    const { db, metaTableName, logger, ...schemaOptions } = options;
    this.db = db;
    this.schemaOptions = schemaOptions;
    this.logger = logger;

    const prefix = schemaOptions.tablePrefix ?? DEFAULT_TABLE_PREFIX;
    this.metaTable = tableRef(metaTableName ?? `${prefix}migrations`, schemaOptions.schema);
  }

  /**
   * Creates the meta table if it is not there yet.
   *
   * Every entry point calls it, so a fresh database needs no separate bootstrap
   * step — `pending()` on an empty database works.
   */
  private async ensureMetaTable(): Promise<void> {
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS ${this.metaTable} (
        "name" varchar(255) PRIMARY KEY,
        "executed_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  private async appliedNames(): Promise<Set<string>> {
    await this.ensureMetaTable();
    const result = await this.db.execute<{ name: string }>(
      sql`SELECT "name" FROM ${this.metaTable}`,
    );
    return new Set(result.rows.map((row) => row.name));
  }

  /**
   * Applied migrations, in the order they are declared in `rbacMigrations`.
   *
   * Derived from the declared list rather than from the meta table's own order,
   * so `down` reverts in exactly the reverse of the order `up` applies.
   */
  public async executed(): Promise<RbacMigrationMeta[]> {
    const applied = await this.appliedNames();
    return rbacMigrations.filter((migration) => applied.has(migration.name)).map(toMeta);
  }

  public async pending(): Promise<RbacMigrationMeta[]> {
    const applied = await this.appliedNames();
    return rbacMigrations.filter((migration) => !applied.has(migration.name)).map(toMeta);
  }

  public async up(options?: RbacMigrateOptions): Promise<RbacMigrationMeta[]> {
    const applied = await this.appliedNames();
    const pending = rbacMigrations.filter((migration) => !applied.has(migration.name));
    const batch = options?.step === undefined ? pending : pending.slice(0, options.step);

    for (const migration of batch) {
      await this.run(migration, "up");
    }
    return batch.map(toMeta);
  }

  public async down(options?: RbacRevertOptions): Promise<RbacMigrationMeta[]> {
    const applied = await this.appliedNames();
    const executed = rbacMigrations.filter((migration) => applied.has(migration.name)).reverse();
    const batch = options?.to === 0 ? executed : executed.slice(0, options?.step ?? 1);

    for (const migration of batch) {
      await this.run(migration, "down");
    }
    return batch.map(toMeta);
  }

  /**
   * One migration and its meta row, in a single transaction: PostgreSQL runs
   * DDL transactionally, so a failure halfway through leaves neither the tables
   * nor the record of them behind.
   */
  private async run(migration: RbacMigration, direction: "up" | "down"): Promise<void> {
    this.logger?.info({
      event: direction === "up" ? "migrating" : "reverting",
      name: migration.name,
    });

    await this.db.transaction(async (tx) => {
      await migration[direction]({ context: tx }, this.schemaOptions);
      await (direction === "up"
        ? tx.execute(sql`INSERT INTO ${this.metaTable} ("name") VALUES (${migration.name})`)
        : tx.execute(sql`DELETE FROM ${this.metaTable} WHERE "name" = ${migration.name}`));
    });

    this.logger?.info({
      event: direction === "up" ? "migrated" : "reverted",
      name: migration.name,
    });
  }
}

function toMeta(migration: RbacMigration): RbacMigrationMeta {
  return { name: migration.name };
}

export function createRbacMigrator(options: RbacMigratorOptions): RbacMigrator {
  return new RbacMigrator(options);
}
