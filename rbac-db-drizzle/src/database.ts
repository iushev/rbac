import type { TablesRelationalConfig } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgDatabase } from "drizzle-orm/pg-core";

/**
 * Any Drizzle handle over node-postgres: the database itself or a transaction
 * (`PgTransaction` is a `PgDatabase`, so one type covers both).
 *
 * `query` and `_` are omitted deliberately. Their types are derived from the
 * application's own Drizzle schema, which this package knows nothing about, and
 * leaving them in makes a `drizzle(pool)` declared without a schema fail to
 * match a type expecting one — and the other way round. Nothing here touches
 * the relational query API; the SQL builders and `execute` are enough.
 */
export type RbacDatabase = Omit<
  PgDatabase<NodePgQueryResultHKT, Record<string, unknown>, TablesRelationalConfig>,
  "query" | "_"
>;
