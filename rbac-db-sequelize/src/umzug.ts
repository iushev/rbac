import type { QueryInterface, Sequelize } from "sequelize";
import { SequelizeStorage, Umzug } from "umzug";

import { rbacMigrations } from "./migrations/index.js";
import { DEFAULT_TABLE_PREFIX, type RbacSchemaOptions } from "./tableNames.js";

/**
 * Umzug logger shape. `console` satisfies it; `undefined` keeps the migrator
 * quiet, which is the default — a library should not write to the app's stdout.
 */
export type RbacMigratorLogger = Record<
  "info" | "warn" | "error" | "debug",
  (message: Record<string, unknown>) => void
>;

export interface RbacMigratorOptions extends RbacSchemaOptions {
  /** The connection to migrate. As everywhere else, the application owns it. */
  sequelize: Sequelize;
  /**
   * Table recording which migrations ran. Defaults to `<tablePrefix>migrations`,
   * deliberately separate from the application's own meta table — the two sets
   * of migrations are versioned independently.
   */
  metaTableName?: string;
  /** Pass `console` to see what is applied. Silent by default. */
  logger?: RbacMigratorLogger;
}

export type RbacMigrator = Umzug<QueryInterface>;

/**
 * An Umzug instance over this package's migrations.
 *
 * Kept out of the package entry point so that `umzug` stays an optional peer:
 * applications that run the migrations some other way never load it.
 */
export function createRbacMigrator(options: RbacMigratorOptions): RbacMigrator {
  const { sequelize, metaTableName, logger, ...schemaOptions } = options;
  const prefix = schemaOptions.tablePrefix ?? DEFAULT_TABLE_PREFIX;
  const tableName = metaTableName ?? `${prefix}migrations`;

  return new Umzug<QueryInterface>({
    migrations: rbacMigrations.map(({ name, up, down }) => ({
      name,
      up: (params) => up(params, schemaOptions),
      down: (params) => down(params, schemaOptions),
    })),
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({
      sequelize,
      // Model name follows the table name, so two migrators with different
      // prefixes can coexist on one connection. Same rule as the four models.
      modelName: tableName,
      tableName,
      schema: schemaOptions.schema,
    }),
    logger,
  });
}
