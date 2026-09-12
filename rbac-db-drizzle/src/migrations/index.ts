import type { RbacDatabase } from "../database.js";
import type { RbacSchemaOptions } from "../tableNames.js";
import * as createRbacTables from "./20260908183000-create-rbac-tables.js";

/** What every migration file in this directory exports, plus the name it is stored under. */
export interface RbacMigration {
  /** The file name without extension. This is the key written to the meta table. */
  name: string;
  // Function properties, not method shorthand: these get destructured off the
  // object, and method shorthand would leave `this` unbound.
  up: (params: { context: RbacDatabase }, options?: RbacSchemaOptions) => Promise<void>;
  down: (params: { context: RbacDatabase }, options?: RbacSchemaOptions) => Promise<void>;
}

/**
 * Every migration, in the order they are applied.
 *
 * An explicit list rather than a glob over `dist/migrations`: the package is
 * consumed as a dependency, where globbing its own files is fragile, and this
 * way a missing registration is a review comment instead of a silent no-op.
 */
export const rbacMigrations: readonly RbacMigration[] = [
  { name: "20260908183000-create-rbac-tables", ...createRbacTables },
];
