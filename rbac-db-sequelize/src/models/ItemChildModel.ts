import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type ModelStatic } from "sequelize";

import { alreadyDefined, baseModelOptions, type DefineModelOptions } from "./base.js";

/** One edge of the hierarchy. */
export class ItemChildModel extends Model<InferAttributes<ItemChildModel>, InferCreationAttributes<ItemChildModel>> {
  declare parentName: string;
  declare childName: string;
}

export function defineItemChildModel(options: DefineModelOptions): ModelStatic<ItemChildModel> {
  const existing = alreadyDefined<ItemChildModel>(options);
  if (existing) {
    return existing;
  }

  class ItemChild extends ItemChildModel {}

  return ItemChild.init(
    {
      parentName: { type: DataTypes.STRING(64), field: "parent_name", primaryKey: true },
      childName: { type: DataTypes.STRING(64), field: "child_name", primaryKey: true },
    },
    { ...baseModelOptions(options), timestamps: false },
  );
}
