import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type ModelStatic,
} from "sequelize";

import { alreadyDefined, baseModelOptions, type DefineModelOptions } from "./base.js";

export class AssignmentModel extends Model<InferAttributes<AssignmentModel>, InferCreationAttributes<AssignmentModel>> {
  declare username: string;
  declare itemName: string;
  declare createdAt: CreationOptional<Date>;
}

export function defineAssignmentModel(options: DefineModelOptions): ModelStatic<AssignmentModel> {
  const existing = alreadyDefined<AssignmentModel>(options);
  if (existing) {
    return existing;
  }

  class Assignment extends AssignmentModel {}

  return Assignment.init(
    {
      username: { type: DataTypes.STRING(64), primaryKey: true },
      itemName: { type: DataTypes.STRING(64), field: "item_name", primaryKey: true },
      createdAt: { type: DataTypes.DATE, field: "created_at" },
    },
    { ...baseModelOptions(options), updatedAt: false },
  );
}
