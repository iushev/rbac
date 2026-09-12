import type { Model, ModelStatic, Sequelize } from "sequelize";

/** What every model definition needs: where to define it, and under what name. */
export interface DefineModelOptions {
  /** The connection the model is defined on. */
  sequelize: Sequelize;
  /** Table name, already resolved from the prefix. Doubles as the model name. */
  tableName: string;
  /** PostgreSQL schema holding the table, if not the connection's search path. */
  schema?: string;
}

/**
 * Model options shared by all four definitions.
 *
 * The model name is the table name, so two stores with different prefixes can
 * coexist on one connection without colliding in `sequelize.models`.
 */
export function baseModelOptions({ sequelize, tableName, schema }: DefineModelOptions) {
  return {
    sequelize,
    schema,
    tableName,
    modelName: tableName,
    freezeTableName: true,
    underscored: true,
  } as const;
}

/**
 * The model already registered under this table name, if any.
 *
 * Definitions are idempotent: a second store with the same prefix reuses what
 * is there rather than redefining it.
 */
export function alreadyDefined<M extends Model>({
  sequelize,
  tableName,
}: DefineModelOptions): ModelStatic<M> | undefined {
  return sequelize.models[tableName] as ModelStatic<M> | undefined;
}
