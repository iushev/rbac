import {
  ItemType,
  isRole,
  type Assignment,
  type Item,
  type Permission,
  type RbacManagerStore,
  type Role,
  type Rule,
} from "@iushev/rbac";
import { QueryTypes, type Sequelize, type Transaction } from "sequelize";

import {
  defineRbacModels,
  type AssignmentModel,
  type ItemModel,
  type RbacModels,
  type RuleModel,
} from "./models/index.js";
import { quoteTable, resolveTableNames, type RbacSchemaOptions } from "./tableNames.js";

export interface SequelizeRbacStoreOptions extends RbacSchemaOptions {
  /** An existing connection. The store never opens or closes one of its own. */
  sequelize: Sequelize;
  /**
   * Transaction every statement runs in. Set it to make a whole sequence of
   * `RbacManager` calls atomic; see {@link SequelizeRbacStore.withTransaction}.
   */
  transaction?: Transaction;
}

/** Raw row shape returned by the recursive descendant queries. */
interface ItemRow {
  name: string;
  type: string;
  description: string | null;
  rule_name: string | null;
  data: string | null;
}

/**
 * A complete {@link RbacManagerStore} backed by PostgreSQL through Sequelize.
 *
 * Behaviour matches `InMemoryRbacStore` exactly — the two are interchangeable
 * under `RbacManager`. Two things are delegated to the database rather than
 * reimplemented: renames propagate through `ON UPDATE CASCADE`, and removals
 * cascade through `ON DELETE CASCADE` / `SET NULL` (see `schema.ts`).
 *
 * Policy that does not depend on the backend — loop detection, rejecting a role
 * under a permission — stays in `RbacManager` and is deliberately absent here.
 */
export class SequelizeRbacStore implements RbacManagerStore {
  private readonly sequelize: Sequelize;
  private readonly models: RbacModels;
  private readonly transaction: Transaction | undefined;
  /** Quoted, schema-qualified table names, for the hand-written CTEs. */
  private readonly tables: { item: string; itemChild: string; assignment: string };
  private readonly schemaOptions: RbacSchemaOptions;

  constructor(options: SequelizeRbacStoreOptions) {
    const { sequelize, transaction, ...schemaOptions } = options;
    this.sequelize = sequelize;
    this.transaction = transaction;
    this.schemaOptions = schemaOptions;
    this.models = defineRbacModels(sequelize, schemaOptions);

    const names = resolveTableNames(schemaOptions);
    this.tables = {
      item: quoteTable(names.item, schemaOptions.schema),
      itemChild: quoteTable(names.itemChild, schemaOptions.schema),
      assignment: quoteTable(names.assignment, schemaOptions.schema),
    };
  }

  /**
   * Runs `fn` against a store bound to a transaction, committing on success and
   * rolling back on error. Use it to make a multi-step `RbacManager` sequence
   * atomic:
   *
   * ```ts
   * await store.withTransaction(async (tx) => {
   *   const manager = new RbacManager({ store: tx });
   *   await manager.add(role);
   *   await manager.assign(role, "alice");
   * });
   * ```
   */
  public async withTransaction<T>(fn: (store: SequelizeRbacStore) => Promise<T>): Promise<T> {
    if (this.transaction) {
      return fn(this);
    }
    return this.sequelize.transaction((transaction) =>
      fn(
        new SequelizeRbacStore({
          sequelize: this.sequelize,
          transaction,
          ...this.schemaOptions,
        }),
      ),
    );
  }

  /** Options threaded into every Sequelize call so the transaction is honoured. */
  private get opts(): { transaction: Transaction | undefined } {
    return { transaction: this.transaction };
  }

  private toItem(row: ItemModel): Item {
    return {
      type: row.type === ItemType.role ? ItemType.role : ItemType.permission,
      name: row.name,
      description: row.description,
      ruleName: row.ruleName,
      data: row.data,
    };
  }

  private rowToItem(row: ItemRow): Item {
    return {
      type: row.type === ItemType.role ? ItemType.role : ItemType.permission,
      name: row.name,
      description: row.description,
      ruleName: row.rule_name,
      data: row.data,
    };
  }

  private toRule(row: RuleModel): Rule {
    return { name: row.name, data: row.data };
  }

  private toAssignment(row: AssignmentModel): Assignment {
    return { username: row.username, itemName: row.itemName };
  }

  private index(rows: ItemModel[]): Map<string, Item> {
    return new Map(rows.map((row) => [row.name, this.toItem(row)]));
  }

  // ----------------------------------------------------------- RbacStore ---

  public async getItem(name: string): Promise<Item | null> {
    const row = await this.models.Item.findByPk(name, this.opts);
    return row ? this.toItem(row) : null;
  }

  public async getItems(type?: ItemType): Promise<Map<string, Item>> {
    const rows = await this.models.Item.findAll({
      ...this.opts,
      ...(type ? { where: { type } } : {}),
    });
    return this.index(rows);
  }

  public async getChildren(name: string): Promise<Map<string, Item>> {
    return this.neighbours(name, "parent_name", "child_name");
  }

  public async getParents(name: string): Promise<Map<string, Item>> {
    return this.neighbours(name, "child_name", "parent_name");
  }

  /**
   * One join rather than two round trips. The join also drops edges whose other
   * end no longer has an item, matching `InMemoryRbacStore.resolve`.
   */
  private async neighbours(
    name: string,
    from: "parent_name" | "child_name",
    to: "parent_name" | "child_name",
  ): Promise<Map<string, Item>> {
    const rows = await this.sequelize.query<ItemRow>(
      `SELECT i.* FROM ${this.tables.item} i
         JOIN ${this.tables.itemChild} e ON i."name" = e."${to}"
        WHERE e."${from}" = :name`,
      { ...this.opts, replacements: { name }, type: QueryTypes.SELECT },
    );
    return new Map(rows.map((row) => [row.name, this.rowToItem(row)]));
  }

  public async getRule(name: string): Promise<Rule | null> {
    const row = await this.models.Rule.findByPk(name, this.opts);
    return row ? this.toRule(row) : null;
  }

  public async getRules(): Promise<Map<string, Rule>> {
    const rows = await this.models.Rule.findAll(this.opts);
    return new Map(rows.map((row) => [row.name, this.toRule(row)]));
  }

  public async getAssignment(itemName: string, username: string): Promise<Assignment | null> {
    const row = await this.models.Assignment.findOne({
      ...this.opts,
      where: { username, itemName },
    });
    return row ? this.toAssignment(row) : null;
  }

  public async getAssignments(username: string): Promise<Map<string, Assignment>> {
    const rows = await this.models.Assignment.findAll({ ...this.opts, where: { username } });
    return new Map(rows.map((row) => [row.itemName, this.toAssignment(row)]));
  }
  // ---------------------------------------------------- items and rules ---

  public async addItem(item: Item): Promise<boolean> {
    if (await this.models.Item.findByPk(item.name, this.opts)) {
      throw new Error(`Item "${item.name}" already exists.`);
    }
    await this.models.Item.create(
      {
        name: item.name,
        type: item.type,
        description: item.description,
        ruleName: item.ruleName,
        data: item.data,
      },
      this.opts,
    );
    return true;
  }

  /**
   * A rename is a plain `UPDATE` of the primary key: `ON UPDATE CASCADE` on the
   * hierarchy and assignment foreign keys carries it across, so unlike
   * `InMemoryRbacStore` there is nothing to rewrite by hand.
   */
  public async updateItem(name: string, item: Item): Promise<boolean> {
    if (!(await this.models.Item.findByPk(name, this.opts))) {
      return false;
    }
    if (name !== item.name && (await this.models.Item.findByPk(item.name, this.opts))) {
      throw new Error(`Item "${item.name}" already exists.`);
    }

    await this.models.Item.update(
      {
        name: item.name,
        type: item.type,
        description: item.description,
        ruleName: item.ruleName,
        data: item.data,
      },
      { ...this.opts, where: { name } },
    );
    return true;
  }

  /** Hierarchy edges and assignments go with it, through `ON DELETE CASCADE`. */
  public async removeItem(item: Item): Promise<boolean> {
    const removed = await this.models.Item.destroy({ ...this.opts, where: { name: item.name } });
    return removed > 0;
  }

  public async addRule(rule: Rule): Promise<boolean> {
    if (await this.models.Rule.findByPk(rule.name, this.opts)) {
      throw new Error(`Rule "${rule.name}" already exists.`);
    }
    await this.models.Rule.create({ name: rule.name, data: rule.data }, this.opts);
    return true;
  }

  /** Renaming propagates to every referencing `rule_name` via `ON UPDATE CASCADE`. */
  public async updateRule(name: string, rule: Rule): Promise<boolean> {
    if (!(await this.models.Rule.findByPk(name, this.opts))) {
      return false;
    }
    if (name !== rule.name && (await this.models.Rule.findByPk(rule.name, this.opts))) {
      throw new Error(`Rule "${rule.name}" already exists.`);
    }

    await this.models.Rule.update({ name: rule.name, data: rule.data }, { ...this.opts, where: { name } });
    return true;
  }

  /** Referencing items have `rule_name` cleared by `ON DELETE SET NULL`. */
  public async removeRule(rule: Rule): Promise<boolean> {
    const removed = await this.models.Rule.destroy({ ...this.opts, where: { name: rule.name } });
    return removed > 0;
  }

  // ------------------------------------------------------------ hierarchy ---

  public async addChild(parent: Item, child: Item): Promise<boolean> {
    const existing = await this.models.Item.findAll({
      ...this.opts,
      where: { name: [parent.name, child.name] },
      attributes: ["name"],
    });
    const names = new Set(existing.map((row) => row.name));
    if (!names.has(parent.name) || !names.has(child.name)) {
      throw new Error(`Both "${parent.name}" and "${child.name}" must exist before linking them.`);
    }

    const [, created] = await this.models.ItemChild.findOrCreate({
      ...this.opts,
      where: { parentName: parent.name, childName: child.name },
      defaults: { parentName: parent.name, childName: child.name },
    });
    return created;
  }

  public async removeChild(parent: Item, child: Item): Promise<boolean> {
    const removed = await this.models.ItemChild.destroy({
      ...this.opts,
      where: { parentName: parent.name, childName: child.name },
    });
    return removed > 0;
  }

  public async removeChildren(parent: Item): Promise<boolean> {
    const removed = await this.models.ItemChild.destroy({
      ...this.opts,
      where: { parentName: parent.name },
    });
    return removed > 0;
  }

  public async hasChild(parent: Item, child: Item): Promise<boolean> {
    const count = await this.models.ItemChild.count({
      ...this.opts,
      where: { parentName: parent.name, childName: child.name },
    });
    return count > 0;
  }

  // ---------------------------------------------------------- assignments ---

  /** Idempotent: an existing assignment is returned untouched. */
  public async assign(item: Role | Permission, username: string): Promise<Assignment> {
    const [row] = await this.models.Assignment.findOrCreate({
      ...this.opts,
      where: { username, itemName: item.name },
      defaults: { username, itemName: item.name },
    });
    return this.toAssignment(row);
  }

  public async revoke(item: Role | Permission, username: string): Promise<boolean> {
    const removed = await this.models.Assignment.destroy({
      ...this.opts,
      where: { username, itemName: item.name },
    });
    return removed > 0;
  }

  public async revokeAll(username: string): Promise<boolean> {
    const removed = await this.models.Assignment.destroy({ ...this.opts, where: { username } });
    return removed > 0;
  }

  public async getUsernamesByRole(roleName: string): Promise<string[]> {
    const rows = await this.sequelize.query<{ username: string }>(
      `SELECT DISTINCT "username" FROM ${this.tables.assignment} WHERE "item_name" = :roleName`,
      { ...this.opts, replacements: { roleName }, type: QueryTypes.SELECT },
    );
    return rows.map((row) => row.username);
  }

  // -------------------------------------------------------------- queries ---

  public async getRolesByUser(username: string): Promise<Map<string, Role>> {
    const rows = await this.sequelize.query<ItemRow>(
      `SELECT i.* FROM ${this.tables.item} i
         JOIN ${this.tables.assignment} a ON i."name" = a."item_name"
        WHERE a."username" = :username AND i."type" = :type`,
      {
        ...this.opts,
        replacements: { username, type: ItemType.role },
        type: QueryTypes.SELECT,
      },
    );
    return this.mapRoles(rows);
  }

  public async getChildRoles(roleName: string): Promise<Map<string, Role>> {
    const role = await this.getItem(roleName);
    if (!role || !isRole(role)) {
      throw new Error(`Role "${roleName}" not found.`);
    }

    const roles = this.mapRoles(await this.descendantsOfItem(roleName, ItemType.role));
    // The contract includes the role itself, first.
    return new Map<string, Role>([[roleName, role], ...roles]);
  }

  public async getPermissionsByRole(roleName: string): Promise<Map<string, Permission>> {
    return this.mapPermissions(await this.descendantsOfItem(roleName, ItemType.permission));
  }

  /** Directly assigned permissions plus every permission below any assigned item. */
  public async getPermissionsByUser(username: string): Promise<Map<string, Permission>> {
    const rows = await this.sequelize.query<ItemRow>(
      `WITH RECURSIVE reachable("name") AS (
           SELECT a."item_name" FROM ${this.tables.assignment} a WHERE a."username" = :username
         UNION
           SELECT e."child_name" FROM ${this.tables.itemChild} e
             JOIN reachable r ON e."parent_name" = r."name"
       )
       SELECT i.* FROM ${this.tables.item} i
         JOIN reachable r ON i."name" = r."name"
        WHERE i."type" = :type`,
      {
        ...this.opts,
        replacements: { username, type: ItemType.permission },
        type: QueryTypes.SELECT,
      },
    );
    return this.mapPermissions(rows);
  }

  /**
   * Every item of `type` below `root`, at any depth, in one round trip.
   *
   * `UNION` rather than `UNION ALL` deduplicates as it goes, so a cycle in the
   * hierarchy terminates the recursion instead of running away. The seed row
   * excludes `root` itself, matching `InMemoryRbacStore.descendants`.
   */
  private async descendantsOfItem(root: string, type: ItemType): Promise<ItemRow[]> {
    return this.sequelize.query<ItemRow>(
      `WITH RECURSIVE descendants("name") AS (
           SELECT e."child_name" FROM ${this.tables.itemChild} e WHERE e."parent_name" = :root
         UNION
           SELECT e."child_name" FROM ${this.tables.itemChild} e
             JOIN descendants d ON e."parent_name" = d."name"
       )
       SELECT i.* FROM ${this.tables.item} i
         JOIN descendants d ON i."name" = d."name"
        WHERE i."type" = :type`,
      { ...this.opts, replacements: { root, type }, type: QueryTypes.SELECT },
    );
  }

  private mapRoles(rows: ItemRow[]): Map<string, Role> {
    return new Map(rows.map((row) => [row.name, this.rowToItem(row) as Role]));
  }

  private mapPermissions(rows: ItemRow[]): Map<string, Permission> {
    return new Map(rows.map((row) => [row.name, this.rowToItem(row) as Permission]));
  }

  // ----------------------------------------------------------------- bulk ---

  public async removeAll(): Promise<void> {
    // Ordered so foreign keys never block the delete.
    await this.models.Assignment.destroy({ ...this.opts, where: {} });
    await this.models.ItemChild.destroy({ ...this.opts, where: {} });
    await this.models.Item.destroy({ ...this.opts, where: {} });
    await this.models.Rule.destroy({ ...this.opts, where: {} });
  }

  /** Edges and assignments of the removed items follow through `ON DELETE CASCADE`. */
  public async removeAllRoles(): Promise<void> {
    await this.models.Item.destroy({ ...this.opts, where: { type: ItemType.role } });
  }

  public async removeAllPermissions(): Promise<void> {
    await this.models.Item.destroy({ ...this.opts, where: { type: ItemType.permission } });
  }

  /** Referencing items have `rule_name` cleared by `ON DELETE SET NULL`. */
  public async removeAllRules(): Promise<void> {
    await this.models.Rule.destroy({ ...this.opts, where: {} });
  }

  public async removeAllAssignments(): Promise<void> {
    await this.models.Assignment.destroy({ ...this.opts, where: {} });
  }
}
