import type { ModelStatic, Sequelize } from "sequelize";

import { resolveTableNames, type RbacSchemaOptions } from "../tableNames.js";
import { defineAssignmentModel, type AssignmentModel } from "./AssignmentModel.js";
import { defineItemChildModel, type ItemChildModel } from "./ItemChildModel.js";
import { defineItemModel, type ItemModel } from "./ItemModel.js";
import { defineRuleModel, type RuleModel } from "./RuleModel.js";

export { RuleModel, defineRuleModel } from "./RuleModel.js";
export { ItemModel, defineItemModel } from "./ItemModel.js";
export { ItemChildModel, defineItemChildModel } from "./ItemChildModel.js";
export { AssignmentModel, defineAssignmentModel } from "./AssignmentModel.js";
export { baseModelOptions, alreadyDefined } from "./base.js";
export type { DefineModelOptions } from "./base.js";

export interface RbacModels {
  Rule: ModelStatic<RuleModel>;
  Item: ModelStatic<ItemModel>;
  ItemChild: ModelStatic<ItemChildModel>;
  Assignment: ModelStatic<AssignmentModel>;
}

/**
 * Defines the four models on the given connection.
 *
 * Model names are derived from the table names, so two stores with different
 * prefixes can coexist on one `Sequelize` instance. Definitions are idempotent:
 * a second store with the same prefix reuses the models already registered.
 */
export function defineRbacModels(sequelize: Sequelize, options?: RbacSchemaOptions): RbacModels {
  const tables = resolveTableNames(options);
  const schema = options?.schema;

  return {
    Rule: defineRuleModel({ sequelize, schema, tableName: tables.rule }),
    Item: defineItemModel({ sequelize, schema, tableName: tables.item }),
    ItemChild: defineItemChildModel({ sequelize, schema, tableName: tables.itemChild }),
    Assignment: defineAssignmentModel({ sequelize, schema, tableName: tables.assignment }),
  };
}
