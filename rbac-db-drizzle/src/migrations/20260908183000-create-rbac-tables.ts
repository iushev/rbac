import { sql } from "drizzle-orm";

import type { RbacDatabase } from "../database.js";
import { createRbacSchema } from "../schema.js";
import { resolveTableNames, type RbacSchemaOptions } from "../tableNames.js";

/**
 * Initial migration, in the shape the runner passes around
 * (`{ context: db }`, mirroring umzug).
 *
 * The only definition of the schema: applications without a migration runner
 * import `up` from here and hand it a Drizzle handle themselves. The referential
 * actions below are not decoration — `DrizzleRbacStore` leans on every one of
 * them instead of cascading by hand:
 *
 *   - `ON UPDATE CASCADE` — renaming an item or a rule propagates to the edges,
 *     the assignments and `rule_name`, which is what `InMemoryRbacStore` does by
 *     rewriting its maps.
 *   - `ON DELETE CASCADE` — a removed item takes its edges and assignments.
 *   - `ON DELETE SET NULL` — a removed rule clears `rule_name`.
 */
export async function up(
  { context }: { context: RbacDatabase },
  options?: RbacSchemaOptions,
): Promise<void> {
  const t = resolveTableNames(options);
  const { rule, item, itemChild, assignment } = createRbacSchema(options);

  await context.execute(sql`
    CREATE TABLE ${rule} (
      "name" varchar(64) PRIMARY KEY,
      "data" text,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )
  `);

  await context.execute(sql`
    CREATE TABLE ${item} (
      "name" varchar(64) PRIMARY KEY,
      "type" varchar(16) NOT NULL,
      "description" text,
      "rule_name" varchar(64)
        REFERENCES ${rule} ("name") ON UPDATE CASCADE ON DELETE SET NULL,
      "data" text,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT ${sql.identifier(`${t.item}_type_check`)}
        CHECK ("type" IN ('role', 'permission'))
    )
  `);
  await context.execute(
    sql`CREATE INDEX ${sql.identifier(`${t.item}_type_idx`)} ON ${item} ("type")`,
  );
  await context.execute(
    sql`CREATE INDEX ${sql.identifier(`${t.item}_rule_name_idx`)} ON ${item} ("rule_name")`,
  );

  await context.execute(sql`
    CREATE TABLE ${itemChild} (
      "parent_name" varchar(64) NOT NULL
        REFERENCES ${item} ("name") ON UPDATE CASCADE ON DELETE CASCADE,
      "child_name" varchar(64) NOT NULL
        REFERENCES ${item} ("name") ON UPDATE CASCADE ON DELETE CASCADE,
      PRIMARY KEY ("parent_name", "child_name")
    )
  `);
  // Access checks walk the hierarchy upward, so getParents is the hot path.
  await context.execute(
    sql`CREATE INDEX ${sql.identifier(`${t.itemChild}_child_name_idx`)}
          ON ${itemChild} ("child_name")`,
  );

  await context.execute(sql`
    CREATE TABLE ${assignment} (
      "username" varchar(64) NOT NULL,
      "item_name" varchar(64) NOT NULL
        REFERENCES ${item} ("name") ON UPDATE CASCADE ON DELETE CASCADE,
      "created_at" timestamptz NOT NULL,
      PRIMARY KEY ("username", "item_name")
    )
  `);
  await context.execute(
    sql`CREATE INDEX ${sql.identifier(`${t.assignment}_item_name_idx`)}
          ON ${assignment} ("item_name")`,
  );
}

export async function down(
  { context }: { context: RbacDatabase },
  options?: RbacSchemaOptions,
): Promise<void> {
  const { rule, item, itemChild, assignment } = createRbacSchema(options);

  // Children first; CASCADE covers anything the application hung off them.
  for (const table of [assignment, itemChild, item, rule]) {
    await context.execute(sql`DROP TABLE IF EXISTS ${table} CASCADE`);
  }
}
