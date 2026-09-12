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

/** Quotes an identifier for PostgreSQL, qualifying it with the schema when set. */
export function quoteTable(table: string, schema?: string): string {
  const quoted = `"${table.replace(/"/g, '""')}"`;
  return schema ? `"${schema.replace(/"/g, '""')}".${quoted}` : quoted;
}
