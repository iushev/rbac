import { sql, type SQL } from "drizzle-orm";

/** Options shared by everything that has to address the RBAC tables. */
export interface RbacSchemaOptions {
  /**
   * Prefix for the four table names. Defaults to `rbac_`, so the tables do not
   * collide with the application's own.
   */
  tablePrefix?: string;
  /** PostgreSQL schema holding the tables. Defaults to the connection's search path. */
  schema?: string;
}

export interface RbacTableNames {
  rule: string;
  item: string;
  itemChild: string;
  assignment: string;
}

export const DEFAULT_TABLE_PREFIX = "rbac_";

export function resolveTableNames(options?: RbacSchemaOptions): RbacTableNames {
  const prefix = options?.tablePrefix ?? DEFAULT_TABLE_PREFIX;
  return {
    rule: `${prefix}rules`,
    item: `${prefix}items`,
    itemChild: `${prefix}item_children`,
    assignment: `${prefix}assignments`,
  };
}

/**
 * A quoted, optionally schema-qualified table reference for hand-written SQL.
 *
 * The four RBAC tables come from {@link createRbacSchema} and interpolate into
 * a `sql` template on their own; this is for the tables that have no Drizzle
 * definition, such as the migrator's meta table.
 */
export function tableRef(table: string, schema?: string): SQL {
  return schema
    ? sql`${sql.identifier(schema)}.${sql.identifier(table)}`
    : sql`${sql.identifier(table)}`;
}
