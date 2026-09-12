import {
  isRole,
  ItemType,
  type Assignment,
  type Item,
  type Permission,
  type RbacManagerStore,
  type Role,
  type Rule,
} from "@iushev/rbac";
import { and, eq, inArray, is, sql } from "drizzle-orm";
import { PgTransaction } from "drizzle-orm/pg-core";

import type { RbacDatabase } from "./database.js";
import { createRbacSchema, type RbacSchema } from "./schema.js";
import type { RbacSchemaOptions } from "./tableNames.js";

export interface DrizzleRbacStoreOptions extends RbacSchemaOptions {
  /**
   * An existing Drizzle handle. The store never opens or closes a connection of
   * its own. Pass a transaction to bind every statement to it — or go through
   * {@link DrizzleRbacStore.withTransaction}, which does it for you.
   */
  db: RbacDatabase;
}

type ItemRow = RbacSchema["item"]["$inferSelect"];
type RuleRow = RbacSchema["rule"]["$inferSelect"];
type AssignmentRow = RbacSchema["assignment"]["$inferSelect"];

/**
 * Raw row shape of the recursive queries: `SELECT i.*` comes back keyed by
 * column name, which is not what Drizzle's builders map for us.
 */
type RawItemRow = {
  name: string;
  type: string;
  description: string | null;
  rule_name: string | null;
  data: string | null;
};

/**
 * A complete {@link RbacManagerStore} backed by PostgreSQL through Drizzle.
 *
 * Behaviour matches `InMemoryRbacStore` exactly — the two are interchangeable
 * under `RbacManager`. Two things are delegated to the database rather than
 * reimplemented: renames propagate through `ON UPDATE CASCADE`, and removals
 * cascade through `ON DELETE CASCADE` / `SET NULL` (see `src/migrations/`).
 *
 * Policy that does not depend on the backend — loop detection, rejecting a role
 * under a permission — stays in `RbacManager` and is deliberately absent here.
 */
export class DrizzleRbacStore implements RbacManagerStore {
  private readonly db: RbacDatabase;
  private readonly schema: RbacSchema;
  private readonly schemaOptions: RbacSchemaOptions;

  constructor(options: DrizzleRbacStoreOptions) {
    const { db, ...schemaOptions } = options;
    this.db = db;
    this.schemaOptions = schemaOptions;
    this.schema = createRbacSchema(schemaOptions);
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
   *
   * A store already bound to a transaction runs `fn` inline, so nesting the
   * call does not open a savepoint no one asked for.
   */
  public async withTransaction<T>(fn: (store: DrizzleRbacStore) => Promise<T>): Promise<T> {
    if (is(this.db, PgTransaction)) {
      return fn(this);
    }
    return this.db.transaction((tx) => fn(new DrizzleRbacStore({ db: tx, ...this.schemaOptions })));
  }

  /**
   * Normalizes the stored discriminant. The check constraint on `type` already
   * rules everything else out; this is what keeps the return type honest.
   */
  private toItemType(type: string): ItemType {
    return type === ItemType.role ? ItemType.role : ItemType.permission;
  }

  private toItem(row: ItemRow): Item {
    return {
      type: this.toItemType(row.type),
      name: row.name,
      description: row.description,
      ruleName: row.ruleName,
      data: row.data,
    };
  }

  private rawToItem(row: RawItemRow): Item {
    return {
      type: this.toItemType(row.type),
      name: row.name,
      description: row.description,
      ruleName: row.rule_name,
      data: row.data,
    };
  }

  private toRule(row: RuleRow): Rule {
    return { name: row.name, data: row.data };
  }

  private toAssignment(row: AssignmentRow): Assignment {
    return { username: row.username, itemName: row.itemName };
  }

  private index(rows: ItemRow[]): Map<string, Item> {
    return new Map(rows.map((row) => [row.name, this.toItem(row)]));
  }

  // ----------------------------------------------------------- RbacStore ---

  public async getItem(name: string): Promise<Item | null> {
    const { item } = this.schema;
    const [row] = await this.db.select().from(item).where(eq(item.name, name)).limit(1);
    return row ? this.toItem(row) : null;
  }

  public async getItems(type?: ItemType): Promise<Map<string, Item>> {
    const { item } = this.schema;
    const rows = await this.db
      .select()
      .from(item)
      .where(type ? eq(item.type, type) : undefined);
    return this.index(rows);
  }

  public async getChildren(name: string): Promise<Map<string, Item>> {
    const { itemChild } = this.schema;
    return this.neighbours(name, itemChild.parentName, itemChild.childName);
  }

  public async getParents(name: string): Promise<Map<string, Item>> {
    const { itemChild } = this.schema;
    return this.neighbours(name, itemChild.childName, itemChild.parentName);
  }

  /**
   * One round trip rather than two. Selecting the items themselves also drops
   * edges whose other end no longer has an item, matching
   * `InMemoryRbacStore.resolve`.
   */
  private async neighbours(
    name: string,
    from: RbacSchema["itemChild"]["parentName"] | RbacSchema["itemChild"]["childName"],
    to: RbacSchema["itemChild"]["parentName"] | RbacSchema["itemChild"]["childName"],
  ): Promise<Map<string, Item>> {
    const { item, itemChild } = this.schema;
    const rows = await this.db
      .select()
      .from(item)
      .where(
        inArray(item.name, this.db.select({ name: to }).from(itemChild).where(eq(from, name))),
      );
    return this.index(rows);
  }

  public async getRule(name: string): Promise<Rule | null> {
    const { rule } = this.schema;
    const [row] = await this.db.select().from(rule).where(eq(rule.name, name)).limit(1);
    return row ? this.toRule(row) : null;
  }

  public async getRules(): Promise<Map<string, Rule>> {
    const { rule } = this.schema;
    const rows = await this.db.select().from(rule);
    return new Map(rows.map((row) => [row.name, this.toRule(row)]));
  }

  public async getAssignment(itemName: string, username: string): Promise<Assignment | null> {
    const { assignment } = this.schema;
    const [row] = await this.db
      .select()
      .from(assignment)
      .where(and(eq(assignment.username, username), eq(assignment.itemName, itemName)))
      .limit(1);
    return row ? this.toAssignment(row) : null;
  }

  public async getAssignments(username: string): Promise<Map<string, Assignment>> {
    const { assignment } = this.schema;
    const rows = await this.db.select().from(assignment).where(eq(assignment.username, username));
    return new Map(rows.map((row) => [row.itemName, this.toAssignment(row)]));
  }

  // ----------------------------------------------------- items and rules ---

  public async addItem(item: Item): Promise<boolean> {
    if (await this.getItem(item.name)) {
      throw new Error(`Item "${item.name}" already exists.`);
    }
    await this.db.insert(this.schema.item).values({
      name: item.name,
      type: item.type,
      description: item.description,
      ruleName: item.ruleName,
      data: item.data,
    });
    return true;
  }

  /**
   * A rename is a plain `UPDATE` of the primary key: `ON UPDATE CASCADE` on the
   * hierarchy and assignment foreign keys carries it across, so unlike
   * `InMemoryRbacStore` there is nothing to rewrite by hand.
   */
  public async updateItem(name: string, item: Item): Promise<boolean> {
    if (!(await this.getItem(name))) {
      return false;
    }
    if (name !== item.name && (await this.getItem(item.name))) {
      throw new Error(`Item "${item.name}" already exists.`);
    }

    await this.db
      .update(this.schema.item)
      .set({
        name: item.name,
        type: item.type,
        description: item.description,
        ruleName: item.ruleName,
        data: item.data,
      })
      .where(eq(this.schema.item.name, name));
    return true;
  }

  /** Hierarchy edges and assignments go with it, through `ON DELETE CASCADE`. */
  public async removeItem(item: Item): Promise<boolean> {
    const removed = await this.db
      .delete(this.schema.item)
      .where(eq(this.schema.item.name, item.name))
      .returning({ name: this.schema.item.name });
    return removed.length > 0;
  }

  public async addRule(rule: Rule): Promise<boolean> {
    if (await this.getRule(rule.name)) {
      throw new Error(`Rule "${rule.name}" already exists.`);
    }
    await this.db.insert(this.schema.rule).values({ name: rule.name, data: rule.data });
    return true;
  }

  /** Renaming propagates to every referencing `rule_name` via `ON UPDATE CASCADE`. */
  public async updateRule(name: string, rule: Rule): Promise<boolean> {
    if (!(await this.getRule(name))) {
      return false;
    }
    if (name !== rule.name && (await this.getRule(rule.name))) {
      throw new Error(`Rule "${rule.name}" already exists.`);
    }

    await this.db
      .update(this.schema.rule)
      .set({ name: rule.name, data: rule.data })
      .where(eq(this.schema.rule.name, name));
    return true;
  }

  /** Referencing items have `rule_name` cleared by `ON DELETE SET NULL`. */
  public async removeRule(rule: Rule): Promise<boolean> {
    const removed = await this.db
      .delete(this.schema.rule)
      .where(eq(this.schema.rule.name, rule.name))
      .returning({ name: this.schema.rule.name });
    return removed.length > 0;
  }

  // ------------------------------------------------------------ hierarchy ---

  public async addChild(parent: Item, child: Item): Promise<boolean> {
    const { item, itemChild } = this.schema;
    const existing = await this.db
      .select({ name: item.name })
      .from(item)
      .where(inArray(item.name, [parent.name, child.name]));
    const names = new Set(existing.map((row) => row.name));
    if (!names.has(parent.name) || !names.has(child.name)) {
      throw new Error(`Both "${parent.name}" and "${child.name}" must exist before linking them.`);
    }

    const inserted = await this.db
      .insert(itemChild)
      .values({ parentName: parent.name, childName: child.name })
      .onConflictDoNothing()
      .returning({ parentName: itemChild.parentName });
    return inserted.length > 0;
  }

  public async removeChild(parent: Item, child: Item): Promise<boolean> {
    const { itemChild } = this.schema;
    const removed = await this.db
      .delete(itemChild)
      .where(and(eq(itemChild.parentName, parent.name), eq(itemChild.childName, child.name)))
      .returning({ parentName: itemChild.parentName });
    return removed.length > 0;
  }

  public async removeChildren(parent: Item): Promise<boolean> {
    const { itemChild } = this.schema;
    const removed = await this.db
      .delete(itemChild)
      .where(eq(itemChild.parentName, parent.name))
      .returning({ parentName: itemChild.parentName });
    return removed.length > 0;
  }

  public async hasChild(parent: Item, child: Item): Promise<boolean> {
    const { itemChild } = this.schema;
    const [row] = await this.db
      .select({ parentName: itemChild.parentName })
      .from(itemChild)
      .where(and(eq(itemChild.parentName, parent.name), eq(itemChild.childName, child.name)))
      .limit(1);
    return row !== undefined;
  }

  // ---------------------------------------------------------- assignments ---

  /** Idempotent: an existing assignment is returned untouched. */
  public async assign(item: Role | Permission, username: string): Promise<Assignment> {
    const { assignment } = this.schema;

    const [inserted] = await this.db
      .insert(assignment)
      .values({ username, itemName: item.name, createdAt: new Date() })
      .onConflictDoNothing()
      .returning();
    if (inserted) {
      return this.toAssignment(inserted);
    }

    // The conflict means it was already there; hand back what is stored, so a
    // repeated assign keeps the original timestamp.
    const existing = await this.getAssignment(item.name, username);
    if (!existing) {
      throw new Error(`Failed to assign "${item.name}" to "${username}".`);
    }
    return existing;
  }

  public async revoke(item: Role | Permission, username: string): Promise<boolean> {
    const { assignment } = this.schema;
    const removed = await this.db
      .delete(assignment)
      .where(and(eq(assignment.username, username), eq(assignment.itemName, item.name)))
      .returning({ username: assignment.username });
    return removed.length > 0;
  }

  public async revokeAll(username: string): Promise<boolean> {
    const { assignment } = this.schema;
    const removed = await this.db
      .delete(assignment)
      .where(eq(assignment.username, username))
      .returning({ username: assignment.username });
    return removed.length > 0;
  }

  public async getUsernamesByRole(roleName: string): Promise<string[]> {
    const { assignment } = this.schema;
    const rows = await this.db
      .selectDistinct({ username: assignment.username })
      .from(assignment)
      .where(eq(assignment.itemName, roleName));
    return rows.map((row) => row.username);
  }

  // -------------------------------------------------------------- queries ---

  public async getRolesByUser(username: string): Promise<Map<string, Role>> {
    const { assignment, item } = this.schema;
    const rows = await this.db
      .select()
      .from(item)
      .where(
        and(
          eq(item.type, ItemType.role),
          inArray(
            item.name,
            this.db
              .select({ name: assignment.itemName })
              .from(assignment)
              .where(eq(assignment.username, username)),
          ),
        ),
      );
    return new Map(rows.map((row) => [row.name, this.toItem(row) as Role]));
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
    const { assignment, item, itemChild } = this.schema;
    const result = await this.db.execute<RawItemRow>(sql`
      WITH RECURSIVE reachable("name") AS (
          SELECT a."item_name" FROM ${assignment} a WHERE a."username" = ${username}
        UNION
          SELECT e."child_name" FROM ${itemChild} e
            JOIN reachable r ON e."parent_name" = r."name"
      )
      SELECT i.* FROM ${item} i
        JOIN reachable r ON i."name" = r."name"
       WHERE i."type" = ${ItemType.permission}
    `);
    return this.mapPermissions(result.rows);
  }

  /**
   * Every item of `type` below `root`, at any depth, in one round trip.
   *
   * `UNION` rather than `UNION ALL` deduplicates as it goes, so a cycle in the
   * hierarchy terminates the recursion instead of running away. The seed row
   * excludes `root` itself, matching `InMemoryRbacStore.descendants`.
   */
  private async descendantsOfItem(root: string, type: ItemType): Promise<RawItemRow[]> {
    const { item, itemChild } = this.schema;
    const result = await this.db.execute<RawItemRow>(sql`
      WITH RECURSIVE descendants("name") AS (
          SELECT e."child_name" FROM ${itemChild} e WHERE e."parent_name" = ${root}
        UNION
          SELECT e."child_name" FROM ${itemChild} e
            JOIN descendants d ON e."parent_name" = d."name"
      )
      SELECT i.* FROM ${item} i
        JOIN descendants d ON i."name" = d."name"
       WHERE i."type" = ${type}
    `);
    return result.rows;
  }

  private mapRoles(rows: RawItemRow[]): Map<string, Role> {
    return new Map(rows.map((row) => [row.name, this.rawToItem(row) as Role]));
  }

  private mapPermissions(rows: RawItemRow[]): Map<string, Permission> {
    return new Map(rows.map((row) => [row.name, this.rawToItem(row) as Permission]));
  }

  // ----------------------------------------------------------------- bulk ---

  public async removeAll(): Promise<void> {
    // Ordered so foreign keys never block the delete.
    await this.db.delete(this.schema.assignment);
    await this.db.delete(this.schema.itemChild);
    await this.db.delete(this.schema.item);
    await this.db.delete(this.schema.rule);
  }

  /** Edges and assignments of the removed items follow through `ON DELETE CASCADE`. */
  public async removeAllRoles(): Promise<void> {
    await this.db.delete(this.schema.item).where(eq(this.schema.item.type, ItemType.role));
  }

  public async removeAllPermissions(): Promise<void> {
    await this.db.delete(this.schema.item).where(eq(this.schema.item.type, ItemType.permission));
  }

  /** Referencing items have `rule_name` cleared by `ON DELETE SET NULL`. */
  public async removeAllRules(): Promise<void> {
    await this.db.delete(this.schema.rule);
  }

  public async removeAllAssignments(): Promise<void> {
    await this.db.delete(this.schema.assignment);
  }
}
