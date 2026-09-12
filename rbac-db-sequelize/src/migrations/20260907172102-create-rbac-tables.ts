import { DataTypes, type QueryInterface } from "sequelize";

import { resolveTableNames, type RbacSchemaOptions } from "../tableNames.js";

/**
 * Initial migration, in the shape umzug and sequelize-cli pass around
 * (`{ context: queryInterface }`).
 *
 * The only definition of the schema: applications without a migration runner
 * import `up` from here and hand it a query interface themselves.
 */
export async function up({ context }: { context: QueryInterface }, options?: RbacSchemaOptions): Promise<void> {
  const t = resolveTableNames(options);
  const schema = options?.schema;
  const rule = { tableName: t.rule, schema };
  const item = { tableName: t.item, schema };
  const itemChild = { tableName: t.itemChild, schema };
  const assignment = { tableName: t.assignment, schema };

  // `now()` rather than a Sequelize-side default: rows also arrive through the
  // hand-written SQL in SequelizeRbacStore, which does not go past a model.
  const timestamps = {
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: context.sequelize.fn("now") },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: context.sequelize.fn("now") },
  } as const;

  await context.createTable(rule, {
    name: { type: DataTypes.STRING(64), primaryKey: true, allowNull: false },
    data: { type: DataTypes.TEXT, allowNull: true },
    ...timestamps,
  });

  await context.createTable(item, {
    name: { type: DataTypes.STRING(64), primaryKey: true, allowNull: false },
    type: { type: DataTypes.STRING(16), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    // ON DELETE SET NULL is how removeRule clears rule_name off the items.
    rule_name: {
      type: DataTypes.STRING(64),
      allowNull: true,
      references: { model: rule, key: "name" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    data: { type: DataTypes.TEXT, allowNull: true },
    ...timestamps,
  });
  // Named explicitly so it matches the constraint Postgres derives from the
  // inline CHECK in schema.ts, on databases created either way.
  await context.addConstraint(item, {
    name: `${t.item}_type_check`,
    type: "check",
    fields: ["type"],
    where: { type: ["role", "permission"] },
  });
  await context.addIndex(item, { name: `${t.item}_type_idx`, fields: ["type"] });
  await context.addIndex(item, { name: `${t.item}_rule_name_idx`, fields: ["rule_name"] });

  await context.createTable(itemChild, {
    // ON UPDATE CASCADE is what makes renaming an item propagate to its edges.
    parent_name: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      references: { model: item, key: "name" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    child_name: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      references: { model: item, key: "name" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
  });
  // Access checks walk the hierarchy upward, so getParents is the hot path.
  await context.addIndex(itemChild, {
    name: `${t.itemChild}_child_name_idx`,
    fields: ["child_name"],
  });

  await context.createTable(assignment, {
    username: { type: DataTypes.STRING(64), primaryKey: true, allowNull: false },
    item_name: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      references: { model: item, key: "name" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    created_at: { type: DataTypes.DATE, allowNull: false },
  });
  await context.addIndex(assignment, {
    name: `${t.assignment}_item_name_idx`,
    fields: ["item_name"],
  });
}

export async function down({ context }: { context: QueryInterface }, options?: RbacSchemaOptions): Promise<void> {
  const t = resolveTableNames(options);
  const schema = options?.schema;

  // Children first; CASCADE covers anything the application hung off them.
  for (const tableName of [t.assignment, t.itemChild, t.item, t.rule]) {
    await context.dropTable({ tableName, schema }, { cascade: true });
  }
}
