import _ from "lodash";
import { Assignment } from "./Assignment";
import BaseCheckAccess from "./BaseCheckAccess";

import { IItem, ItemType, Permission, Role } from "./Item";
import { Rule, RuleParams } from "./Rule";

export type RbacItem = Role | Permission | Rule;

export interface BaseManagerOptions {
  defaultRoles?: string[];
  logging?: false | ((...args: any[]) => void);
}

/**
 * Manager is a base class implementing for RBAC management.
 */
export default abstract class BaseManager extends BaseCheckAccess {
  /**
   *
   */
  protected logging: false | ((...args: any[]) => void);

  /**
   *
   * @param options
   */
  constructor(options?: BaseManagerOptions) {
    super({
      defaultRoles: options?.defaultRoles,
    });

    this.logging =
      options?.logging && Object.prototype.hasOwnProperty.call(options, "logging") ? options.logging : console.log;
  }

  /**
   *
   * @param args
   */
  protected log(...args: any[]) {
    let logging;

    const last = _.last(args);

    if (last && _.isPlainObject(last) && Object.prototype.hasOwnProperty.call(last, "logging")) {
      const options = last;

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

  /**
   * @inheritdoc
   */
  public async checkAccess(username: string, permissionName: string, params: RuleParams): Promise<boolean> {
    this.log(`Checking access: username=${username}, permissionName=${permissionName}`);

    if (this.items.size === 0) {
      await this.load();
    }

    const assignments = await this.getAssignments(username);
    return super.checkAccess(username, permissionName, params, assignments);
  }

  /**
   *
   * @returns
   */
  public async getRBAC() {
    if (this.items.size === 0) {
      await this.load();
    }

    return {
      items: _.cloneDeep(this.items),
      parents: _.cloneDeep(this.parents),
      rules: _.cloneDeep(this.rules),
    };
  }

  protected invalidateRbac() {
    this.parents.clear();
    this.items.clear();
    this.rules.clear();
  }

  // #########################################################################################################

  /**
   * Adds a role, permission or rule to the RBAC system.
   * @param {RbacItem} object
   * @return {Promise<boolean>} whether the role, permission or rule is successfully added to the system
   * @throws {Error} if data validation or saving fails (such as the name of the role or permission is not unique)
   */
  public async add(object: RbacItem): Promise<boolean> {
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
   * Removes a role, permission or rule from the RBAC system.
   * @param {RbacItem} object
   * @return {Promise<boolean>} whether the role, permission or rule is successfully removed
   * @throws {Error}
   */
  public async remove(object: RbacItem): Promise<boolean> {
    if (object instanceof Role || object instanceof Permission) {
      return this.removeItem(object);
    } else if (object instanceof Rule) {
      return this.removeRule(object);
    }

    throw new Error("Removing unsupported object type.");
  }

  /**
   * Updates the specified role, permission or rule in the system.
   * @param {RbacItem} object
   * @return {Promise<boolean>} whether the update is successful
   * @throws {Error} if data validation or saving fails (such as the name of the role or permission is not unique)
   */
  public async update(name: string, object: RbacItem): Promise<boolean> {
    if (object instanceof Role || object instanceof Permission) {
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
   * Returns the named role.
   * @param {string} name the role name.
   * @return {Promise<Role | null>} the role corresponding to the specified name. Null is returned if no such role.
   */
  public async getRole(name: string): Promise<Role | null> {
    const item = await this.getItem(name);
    return item?.type == ItemType.role ? item : null;
  }

  /**
   * Returns all roles in the system.
   * @return {Promise<Map<string, Role>>} all roles in the system. The array is indexed by the role names.
   */
  public async getRoles(): Promise<Map<string, Role>> {
    return this.getItems(ItemType.role);
  }

  /**
   * Returns the roles that are assigned to the user via assign().
   * Note that child roles that are not assigned directly to the user will not be returned.
   * @param {string} username the user ID
   * @return {Promise<Map<string, Role>>} all roles directly or indirectly assigned to the user. The array is indexed by the role names.
   */
  public abstract getRolesByUser(username: string): Promise<Map<string, Role>>;

  /**
   * Returns child roles of the role specified. Depth isn't limited.
   * @param {string} roleName name of the role to file child roles for
   * @return {Promise<Map<string, Role>>} Child roles. The array is indexed by the role names. First element is an instance of the parent Role itself.
   * @throws {Error} if Role was not found that are getting by $roleName
   */
  public abstract getChildRoles(roleName: string): Promise<Map<string, Role>>;

  /**
   * Returns the named permission.
   * @param {string} name the permission name.
   * @return {Promise<Permission | null>} the permission corresponding to the specified name. Null is returned if no such permission.
   */
  public async getPermission(name: string): Promise<Permission | null> {
    const item = await this.getItem(name);
    return item?.type == ItemType.permission ? item : null;
  }

  /**
   * Returns all permissions in the system.
   * @return {Promise<Map<string, Permission>>} all permissions in the system. The array is indexed by the permission names.
   */
  public async getPermissions(): Promise<Map<string, Permission>> {
    return this.getItems(ItemType.permission);
  }

  /**
   * Returns all permissions that the specified role represents.
   * @param {string} roleName the role name
   * @return {Promise<Map<string, Permission>>} all permissions that the role represents. The array is indexed by the permission names.
   */
  public abstract getPermissionsByRole(roleName: string): Promise<Map<string, Permission>>;

  /**
   * Returns all permissions that the user has.
   * @param {string} username the username
   * @return {Promise<Map<string, Permission>>} all permissions that the user has. The array is indexed by the permission names.
   */
  public abstract getPermissionsByUser(username: string): Promise<Map<string, Permission>>;

  /**
   * Returns the rule of the specified name.
   * @param {string} name the rule name
   * @return {Promise<Rule | null>} the rule object, or null if the specified name does not correspond to a rule.
   */
  public abstract getRule(name: string): Promise<Rule | null>;

  /**
   * Returns all rules available in the system.
   * @return {Promise<Map<string, Rule>>} the rules indexed by the rule names
   */
  public abstract getRules(): Promise<Map<string, Rule>>;

  /**
   * Checks the possibility of adding a child to parent.
   * @param {Item} parent the parent item
   * @param {Item} child the child item to be added to the hierarchy
   * @return {Promise<boolean>} possibility of adding
   */
  public abstract canAddChild(parent: IItem, child: IItem): Promise<boolean>;

  /**
   * Adds an item as a child of another item.
   * @param {Item} parent
   * @param {Item} child
   * @return {Promise<boolean>} whether the child successfully added
   * @throws {Error} if the parent-child relationship already exists or if a loop has been detected.
   */
  public abstract addChild(parent: IItem, child: IItem): Promise<boolean>;

  /**
   * Removes a child from its parent.
   * Note, the child item is not deleted. Only the parent-child relationship is removed.
   * @param {Item} parent
   * @param {Item} child
   * @return {Promise<boolean>} whether the removal is successful
   */
  public abstract removeChild(parent: IItem, child: IItem): Promise<boolean>;

  /**
   * Remove all children from their parent.
   * Note, the children items are not deleted. Only the parent-child relationships are removed.
   * @param {Item} parent
   * @return {Promise<boolean>} whether the removal is successful
   */
  public abstract removeChildren(parent: IItem): Promise<boolean>;

  /**
   * Returns a value indicating whether the child already exists for the parent.
   * @param {Item} parent
   * @param {Item} child
   * @return {Promise<boolean>}  whether `child` is already a child of `parent`
   */
  public abstract hasChild(parent: IItem, child: IItem): Promise<boolean>;

  /**
   * Returns the child permissions and/or roles.
   * @param {string} name the parent name
   * @return {Promise<Map<string, Item>>} the child permissions and/or roles
   */
  public abstract getChildren(name: string): Promise<Map<string, IItem>>;

  /**
   * Assigns a role to a user.
   * @param {Role | Permission} role
   * @param {string} username the username
   * @return {Promise<Assignment>} the role assignment information.
   * @throws {Error} if the role has already been assigned to the user
   */
  public abstract assign(role: Role | Permission, username: string): Promise<Assignment>;

  /**
   * Revokes a role from a user.
   * @param {Role | Permission} role
   * @param {string} username the username
   * @return {Promise<boolean>} whether the revoking is successful
   */
  public abstract revoke(role: Role | Permission, username: string): Promise<boolean>;

  /**
   * Revokes all roles from a user.
   * @param {string} username the username
   * @return {Promise<boolean>} whether the revoking is successful
   */
  public abstract revokeAll(username: string): Promise<boolean>;

  /**
   * Returns the assignment information regarding a role and a user.
   * @param {string} roleName the role name
   * @param {string} username the username
   * @return {Promise<Assignment | null>} the assignment information. Null is returned if the role is not assigned to the user.
   */
  public abstract getAssignment(roleName: string, username: string): Promise<Assignment | null>;

  /**
   * Returns all role assignment information for the specified user.
   * @param {string} username the username
   * @return {Promise<Map<string, Assignment>>} the assignments indexed by role names. An empty array will be returned if there is no role assigned to the user.
   */
  public abstract getAssignments(username: string): Promise<Map<string, Assignment>>;

  /**
   * Returns all usernames assigned to the role specified.
   * @param {string} roleName
   * @return {Promise<string[]>} usernames
   */
  public abstract getUsernamesByRole(roleName: string): Promise<string[]>;

  /**
   * Removes all authorization data, including roles, permissions, rules, and assignments.
   */
  public abstract removeAll(): Promise<void>;

  /**
   * Removes all permissions.
   * All parent child relations will be adjusted accordingly.
   */
  public abstract removeAllPermissions(): Promise<void>;

  /**
   * Removes all roles.
   * All parent child relations will be adjusted accordingly.
   */
  public abstract removeAllRoles(): Promise<void>;

  /**
   * Removes all rules.
   * All roles and permissions which have rules will be adjusted accordingly.
   */
  public abstract removeAllRules(): Promise<void>;

  /**
   * Removes all role assignments.
   */
  public abstract removeAllAssignments(): Promise<void>;

  /**
   * Returns the named auth item.
   * @param {string} name the auth item name.
   * @return {Promise<Item | null>} the auth item corresponding to the specified name. Null is returned if no such item.
   */
  protected abstract getItem(name: string): Promise<IItem | null>;

  /**
   * Returns the items of the specified type.
   * @param {ItemType} type the auth item type
   * @return {Promise<Map<string, Item>>} the auth items of the specified type.
   */
  protected abstract getItems(type: ItemType): Promise<Map<string, IItem>>;

  /**
   * Adds an auth item to the RBAC system.
   * @param {Item} item the item to add
   * @return {Promise<boolean>} whether the auth item is successfully added to the system
   * @throws {Error} if data validation or saving fails (such as the name of the role or permission is not unique)
   */
  protected abstract addItem(item: IItem): Promise<boolean>;

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
  protected abstract removeItem(item: IItem): Promise<boolean>;

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
  protected abstract updateItem(name: string, item: IItem): Promise<boolean>;

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
}
