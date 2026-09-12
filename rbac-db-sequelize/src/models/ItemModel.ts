import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type ModelStatic,
} from "sequelize";

import { alreadyDefined, baseModelOptions, type DefineModelOptions } from "./base.js";

export class ItemModel extends Model<InferAttributes<ItemModel>, InferCreationAttributes<ItemModel>> {
  declare name: string;
  declare type: string;
  declare description: string | null;
  declare ruleName: string | null;
  declare data: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function defineItemModel(options: DefineModelOptions): ModelStatic<ItemModel> {
  const existing = alreadyDefined<ItemModel>(options);
  if (existing) {
    return existing;
  }

  class Item extends ItemModel {}

  return Item.init(
    {
      name: { type: DataTypes.STRING(64), primaryKey: true },
      type: { type: DataTypes.STRING(16), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      ruleName: { type: DataTypes.STRING(64), field: "rule_name", allowNull: true },
      data: { type: DataTypes.TEXT, allowNull: true },
      createdAt: { type: DataTypes.DATE, field: "created_at", allowNull: false },
      updatedAt: { type: DataTypes.DATE, field: "updated_at", allowNull: false },
    },
    { ...baseModelOptions(options) },
  );
}
