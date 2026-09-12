import { pgSchema, pgTable, primaryKey, text, timestamp, varchar } from "drizzle-orm/pg-core";

import { resolveTableNames, type RbacSchemaOptions } from "./tableNames.js";

/**
 * `pgTable`, or its equivalent bound to a PostgreSQL schema.
 *
 * The cast is what lets one call site serve both: `pgSchema(...).table` has the
 * same signature as `pgTable` but a nominally different type, and the schema is
 * carried by the table object at runtime either way.
 */
function tableFactory(schema?: string): typeof pgTable {
  if (!schema) {
    return pgTable;
  }
  const namespace = pgSchema(schema);
  return ((name: string, columns: never, extraConfig: never) =>
    namespace.table(name, columns, extraConfig)) as unknown as typeof pgTable;
}

/**
 * The Drizzle definitions of the four RBAC tables.
 *
 * A factory rather than four module-level `pgTable` constants because the table
 * names depend on `tablePrefix` and `schema`, which the application chooses.
 * That is also why this package ships hand-written migrations instead of a
 * `drizzle-kit` setup: generating DDL needs the names at build time, and here
 * they are only known at run time.
 *
 * Columns only. The DDL that does real work — the foreign keys whose
 * `ON UPDATE` / `ON DELETE` actions are what `DrizzleRbacStore` relies on
 * instead of cascading by hand, plus the indexes and the type check — lives in
 * `src/migrations/` and nowhere else.
 */
export function createRbacSchema(options?: RbacSchemaOptions) {
  const names = resolveTableNames(options);
  const table = tableFactory(options?.schema);

  const timestamps = {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  };

  const rule = table(names.rule, {
    name: varchar("name", { length: 64 }).primaryKey(),
    data: text("data"),
    ...timestamps,
  });

  const item = table(names.item, {
    name: varchar("name", { length: 64 }).primaryKey(),
    type: varchar("type", { length: 16 }).notNull(),
    description: text("description"),
    ruleName: varchar("rule_name", { length: 64 }),
    data: text("data"),
    ...timestamps,
  });

  const itemChild = table(
    names.itemChild,
    {
      parentName: varchar("parent_name", { length: 64 }).notNull(),
      childName: varchar("child_name", { length: 64 }).notNull(),
    },
    (columns) => [primaryKey({ columns: [columns.parentName, columns.childName] })],
  );

  const assignment = table(
    names.assignment,
    {
      username: varchar("username", { length: 64 }).notNull(),
      itemName: varchar("item_name", { length: 64 }).notNull(),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    },
    (columns) => [primaryKey({ columns: [columns.username, columns.itemName] })],
  );

  return { rule, item, itemChild, assignment };
}

export type RbacSchema = ReturnType<typeof createRbacSchema>;
