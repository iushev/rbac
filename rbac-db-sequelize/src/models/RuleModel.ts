import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type ModelStatic,
} from "sequelize";

import { alreadyDefined, baseModelOptions, type DefineModelOptions } from "./base.js";

export class RuleModel extends Model<InferAttributes<RuleModel>, InferCreationAttributes<RuleModel>> {
  declare name: string;
  declare data: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function defineRuleModel(options: DefineModelOptions): ModelStatic<RuleModel> {
  const existing = alreadyDefined<RuleModel>(options);
  if (existing) {
    return existing;
  }

  // A fresh subclass per call: `Model.init` binds a class to one table, so
  // initializing the exported class directly would make a second store with a
  // different prefix silently rebind the first store's model.
  class Rule extends RuleModel {}

  return Rule.init(
    {
      name: { type: DataTypes.STRING(64), primaryKey: true },
      data: { type: DataTypes.TEXT, allowNull: true },
      createdAt: { type: DataTypes.DATE, field: "created_at", allowNull: false },
      updatedAt: { type: DataTypes.DATE, field: "updated_at", allowNull: false },
    },
    { ...baseModelOptions(options), timestamps: true },
  );
}
