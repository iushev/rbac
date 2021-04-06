import _ from "lodash";
import { Assignment } from "./Assignment";

import { Item, ItemType, Permission, Role } from "./Item";
import { ManagerInterface } from "./ManagerInterface";
import { Rule, RuleCtor, RuleParams } from "./Rule";

export interface BaseManagerOptions {
  defaultRoles?: string[];
  logging?: false | ((sql: string, timing?: number) => void);
}

/**
 * Manager is a base class implementing for RBAC management.
 */
export default abstract class BaseManager implements ManagerInterface {
  /**
   *
   */
  public readonly ruleClasses: Map<string, RuleCtor<Rule>> = new Map();

  /**
   * List of role names that are assigned to every user automatically without calling [[assign()]].
   */
  public readonly defaultRoles: string[];

  /**
   *
   */
  protected logging: false | ((sql: string, timing?: number) => void);

  /**
   * Map itemName => Item
   */
  protected items: Map<string, Item> = new Map();

  /**
   * Map itemName => parentName => Item
   * {
   *   [childName: string]: {
   *     [parentName: string]: parent
   *   }
   * }
   */
  protected parents: Map<string, Map<string, Item>> = new Map();

  /**
   * Map ruleName => Rule
   */
  protected rules: Map<string, Rule> = new Map();

  /**
   * Map username => assignmentName => Assignment
   */
  protected assignments: Map<string, Map<string, Assignment>> = new Map();

  /**
   *
   * @param options
   */
  constructor(options?: BaseManagerOptions) {
    this.defaultRoles = options?.defaultRoles || [];

    this.logging = Object.prototype.hasOwnProperty.call(options, "logging") ? options!.logging ?? false : console.log;
  }

  /**
   *
   * @param args
   */
  protected log(...args: any[]) {
    let logging;

    const last = _.last(args);

    if (last && _.isPlainObject(last) && Object.prototype.hasOwnProperty.call(last, "logging")) {
      let options = last;

      // remove options from set of logged arguments if options.logging is equal to console.log
      // eslint-disable-next-line no-console
      if (options.logging === console.log) {
        args.splice(args.length - 1, 1);
        logging = options.logging;
      }
    } else {
      logging = this.logging;
    }

    if (logging) {
      logging(...args);
    }
  }

  protected invalidateRbac() {
    // this.children.clear();
    this.parents.clear();
    this.items.clear();
    this.rules.clear();
    this.assignments.clear();
  }

  /**
   * @inheritdoc
   */
  public async checkAccess(username: string, permissionName: string, params: RuleParams): Promise<boolean> {
    this.log(`Checking access: username=${username}, permissionName=${permissionName}`);
    if (this.items.size === 0) {
      await this.load();
    }
    const assignments = await this.getAssignments(username);
    return this.checkAccessRecursive(username, permissionName, params, assignments);
  }

  public async getRBAC() {
    if (this.items.size === 0) {
      await this.load();
    }

    return {
      items: _.cloneDeep(this.items),
      rules: _.cloneDeep(this.rules),
    }
  }

  /**
   * @inheritdoc
   */
  public createRole(name: string): Role {
    const role = new Role({ name });
    return role;
  }

  /**
   * @inheritdoc
   */
  public createPermission(name: string): Permission {
    const permission = new Permission({ name });
    return permission;
  }

  /**
   * @inheritdoc
   */
  public async add(object: Role | Permission | Rule): Promise<boolean> {
    if (object instanceof Role || object instanceof Permission) {
      if (object.ruleName && (await this.getRule(object.ruleName)) === null) {
        const rule = new Rule(object.ruleName);
        this.addRule(rule);
      }

      return this.addItem(object);
    } else if (object instanceof Rule) {
      return this.addRule(object);
    }

    throw new Error("Adding unsupported object type.");
  }

  /**
   * @inheritdoc
   */
  public async remove(object: Role | Permission | Rule): Promise<boolean> {
    if (object instanceof Item) {
      return this.removeItem(object);
    } else if (object instanceof Rule) {
      return this.removeRule(object);
    }

    throw new Error("Removing unsupported object type.");
  }

  /**
   * @inheritdoc
   */
  public async update(name: string, object: Role | Permission | Rule): Promise<boolean> {
    if (object instanceof Item) {
      if (object.ruleName && (await this.getRule(object.ruleName)) === null) {
        const rule = new Rule(object.ruleName);
        this.addRule(rule);
      }

      return this.updateItem(name, object);
    } else if (object instanceof Rule) {
      return this.updateRule(name, object);
    }

    throw new Error('"Updating unsupported object type."');
  }

  /**
   * @inheritdoc
   */
  public async getRole(name: string): Promise<Role | null> {
    const item = await this.getItem(name);
    return item instanceof Item && item.type == ItemType.role ? item : null;
  }

  /**
   * @inheritdoc
   */
  public async getRoles(): Promise<Map<string, Role>> {
    return this.getItems(ItemType.role);
  }

  /**
   * @inheritdoc
   */
  public abstract getRolesByUser(username: string): Promise<Map<string, Role>>;

  /**
   * @inheritdoc
   */
  public abstract getChildRoles(roleName: string): Promise<Map<string, Role>>;

  /**
   * @inheritdoc
   */
  public async getPermission(name: string): Promise<Permission | null> {
    const item = await this.getItem(name);
    return item instanceof Item && item.type == ItemType.permission ? item : null;
  }

  /**
   * @inheritdoc
   */
  public async getPermissions(): Promise<Map<string, Permission>> {
    return this.getItems(ItemType.permission);
  }

  /**
   * @inheritdoc
   */
  public abstract getPermissionsByRole(roleName: string): Promise<Map<string, Permission>>;

  /**
   * @inheritdoc
   */
  public abstract getPermissionsByUser(username: string): Promise<Map<string, Permission>>;

  /**
   * @inheritdoc
   */
  public abstract getRule(name: string): Promise<Rule | null>;

  /**
   * @inheritdoc
   */
  public abstract getRules(): Promise<Map<string, Rule>>;

  /**
   * @inheritdoc
   */
  public abstract canAddChild(parent: Item, child: Item): Promise<boolean>;

  /**
   * @inheritdoc
   */
  public abstract addChild(parent: Item, child: Item): Promise<boolean>;

  /**
   * @inheritdoc
   */
  public abstract removeChild(parent: Item, child: Item): Promise<boolean>;

  /**
   * @inheritdoc
   */
  public abstract removeChildren(parent: Item): Promise<boolean>;

  /**
   * @inheritdoc
   */
  public abstract hasChild(parent: Item, child: Item): Promise<boolean>;

  /**
   * @inheritdoc
   */
  public abstract getChildren(name: string): Promise<Map<string, Item>>;

  /**
   * @inheritdoc
   */
  public abstract assign(role: Role | Permission, username: string): Promise<Assignment>;

  /**
   * @inheritdoc
   */
  public abstract revoke(role: Role | Permission, username: string): Promise<boolean>;

  /**
   * @inheritdoc
   */
  public abstract revokeAll(username: string): Promise<boolean>;

  /**
   * @inheritdoc
   */
  public abstract getAssignment(roleName: string, username: string): Promise<Assignment | null>;

  /**
   * @inheritdoc
   */
  public abstract getAssignments(username: string): Promise<Map<string, Assignment>>;

  /**
   * @inheritdoc
   */
  public abstract getUsernamesByRole(roleName: string): Promise<string[]>;

  /**
   * @inheritdoc
   */
  public abstract removeAll(): Promise<void>;

  /**
   * @inheritdoc
   */
  public abstract removeAllPermissions(): Promise<void>;

  /**
   * @inheritdoc
   */
  public abstract removeAllRoles(): Promise<void>;

  /**
   * @inheritdoc
   */
  public abstract removeAllRules(): Promise<void>;

  /**
   * @inheritdoc
   */
  public abstract removeAllAssignments(): Promise<void>;

  /**
   * Returns the named auth item.
   * @param {string} name the auth item name.
   * @return {Promise<Item | null>} the auth item corresponding to the specified name. Null is returned if no such item.
   */
  protected abstract getItem(name: string): Promise<Item | null>;

  /**
   * Returns the items of the specified type.
   * @param {ItemType} type the auth item type
   * @return {Promise<Map<string, Item>>} the auth items of the specified type.
   */
  protected abstract getItems(type: ItemType): Promise<Map<string, Item>>;

  /**
   * Adds an auth item to the RBAC system.
   * @param {Item} item the item to add
   * @return {Promise<boolean>} whether the auth item is successfully added to the system
   * @throws {Error} if data validation or saving fails (such as the name of the role or permission is not unique)
   */
  protected abstract addItem(item: Item): Promise<boolean>;

  /**
   * Adds a rule to the RBAC system.
   * @param {Rule} rule the rule to add
   * @return {Promise<boolean>} whether the rule is successfully added to the system
   * @throws {Error} if data validation or saving fails (such as the name of the rule is not unique)
   */
  protected abstract addRule(rule: Rule): Promise<boolean>;

  /**
   * Removes an auth item from the RBAC system.
   * @param {Item} item the item to remove
   * @return {Promise<boolean>} whether the role or permission is successfully removed
   * @throws {Error} if data validation or saving fails (such as the name of the role or permission is not unique)
   */
  protected abstract removeItem(item: Item): Promise<boolean>;

  /**
   * Removes a rule from the RBAC system.
   * @param {Rule} rule the rule to remove
   * @return {Promise<boolean>} whether the rule is successfully removed
   * @throws {Error} if data validation or saving fails (such as the name of the rule is not unique)
   */
  protected abstract removeRule(rule: Rule): Promise<boolean>;

  /**
   * Updates an auth item in the RBAC system.
   * @param {string} name the name of the item being updated
   * @param {Item} item the updated item
   * @return {Promise<boolean>} whether the auth item is successfully updated
   * @throws {Error} if data validation or saving fails (such as the name of the role or permission is not unique)
   */
  protected abstract updateItem(name: string, item: Item): Promise<boolean>;

  /**
   * Updates a rule to the RBAC system.
   * @param {string} name the name of the rule being updated
   * @param {Rule} rule the updated rule
   * @return {Promise<boolean>} whether the rule is successfully updated
   * @throws {Error} if data validation or saving fails (such as the name of the rule is not unique)
   */
  protected abstract updateRule(name: string, rule: Rule): Promise<boolean>;

  /**
   * Load RBAC data
   */
  protected abstract load(): Promise<void>;

  /**
   * Returns defaultRoles as Role objects.
   * @return {Map<string, Role>} default roles.
   */
  protected getDefaultRoleInstances(): Map<string, Role> {
    const roleInstances = new Map();

    this.defaultRoles.forEach((roleName) => {
      const role = new Role({ name: roleName });
      roleInstances.set(roleName, role);
    });

    return roleInstances;
  }

  /**
   * Performs access check for the specified user.
   * This method is internally called by checkAccess().
   * @param {integer} userId the user ID. This should can be either an integer or a string representing
   * the unique identifier of a user.
   * @param {string} itemName the name of the operation that need access check
   * @param {RuleParams} params name-value pairs that would be passed to rules associated
   * with the tasks and roles assigned to the user. A param with name 'user' is added to this array,
   * which holds the value of userId.
   * @param {{ [key: string]: Assignment }} assignments the assignments to the specified user
   * @return {boolean} whether the operations can be performed by the user.
   */
  protected checkAccessRecursive(
    username: string,
    itemName: string,
    params: RuleParams,
    assignments: Map<string, Assignment>
  ): boolean {
    const item = this.items?.get(itemName);

    if (!item) {
      return false;
    }

    if (!this.executeRule(username, item, params)) {
      return false;
    }

    if (assignments.has(itemName) || this.defaultRoles.includes(itemName)) {
      return true;
    }

    const parents = this.parents.get(itemName);
    if (parents && parents.size > 0) {
      for (let parentName of parents.keys()) {
        if (this.checkAccessRecursive(username, parentName, params, assignments)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Executes the rule associated with the specified auth item.
   *
   * If the item does not specify a rule, this method will return true. Otherwise, it will
   * return the value of Rule::execute().
   *
   * @param {integer} userId the user ID. This should be either an integer or a string representing
   * the unique identifier of a user.
   * @param {Item} item the auth item that needs to execute its rule
   * @param {RuleParams} params parameters passed to checkAccess() and will be passed to the rule
   * @return {boolean} the return value of Rule::execute(). If the auth item does not specify a rule, true will be returned.
   * @throws {Error} if the auth item has an invalid rule.
   */
  protected executeRule(username: string, item: Item, params: RuleParams): boolean {
    if (!item.ruleName) {
      return true;
    }

    const rule = this.rules?.get(item.ruleName);

    if (!rule) {
      throw new Error(`Rule "${item.ruleName}" does not exists. Or rules does not loaded.`);
    }

    return rule.execute(username, item, params);
  }
}
