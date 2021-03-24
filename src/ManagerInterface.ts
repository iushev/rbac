import { Assignment } from "./Assignment";
import { CheckAccessInterface } from "./CheckAccessInterface";
import { Item, Permission, Role } from "./Item";
import { Rule } from "./Rule";

export interface ManagerInterface extends CheckAccessInterface {
  /**
   * Creates a new Role object.
   * Note that the newly created role is not added to the RBAC system yet.
   * You must fill in the needed data and call [[add()]] to add it to the system.
   * @param {string} name the role name
   * @return {Role} the new Role object
   */
  createRole(name: string): Role;

  /**
   * Creates a new Permission object.
   * Note that the newly created permission is not added to the RBAC system yet.
   * You must fill in the needed data and call [[add()]] to add it to the system.
   * @param {string} name the permission name
   * @return {Permission} the new Permission object
   */
  createPermission(name: string): Permission;

  /**
   * Adds a role, permission or rule to the RBAC system.
   * @param {Role | Permission | Rule} object
   * @return {Promise<boolean>} whether the role, permission or rule is successfully added to the system
   * @throws {Error} if data validation or saving fails (such as the name of the role or permission is not unique)
   */
  add(object: Role | Permission | Rule): Promise<boolean>;

  /**
   * Removes a role, permission or rule from the RBAC system.
   * @param {Role | Permission | Rule} object
   * @return {Promise<boolean>} whether the role, permission or rule is successfully removed
   * @throws {Error}
   */
  remove(object: Role | Permission | Rule): Promise<boolean>;

  /**
   * Updates the specified role, permission or rule in the system.
   * @param {Role | Permission | Rule} object
   * @return {Promise<boolean>} whether the update is successful
   * @throws {Error} if data validation or saving fails (such as the name of the role or permission is not unique)
   */
  update(name: string, object: Role | Permission | Rule): Promise<boolean>;

  /**
   * Returns the named role.
   * @param {string} name the role name.
   * @return {Promise<Role | null>} the role corresponding to the specified name. Null is returned if no such role.
   */
  getRole(name: string): Promise<Role | null>;

  /**
   * Returns all roles in the system.
   * @return {Promise<Map<string, Role>>} all roles in the system. The array is indexed by the role names.
   */
  getRoles(): Promise<Map<string, Role>>;

  /**
   * Returns the roles that are assigned to the user via assign().
   * Note that child roles that are not assigned directly to the user will not be returned.
   * @param {string} username the user ID
   * @return {Promise<Map<string, Role>>} all roles directly or indirectly assigned to the user. The array is indexed by the role names.
   */
  getRolesByUser(username: string): Promise<Map<string, Role>>;

  /**
   * Returns child roles of the role specified. Depth isn't limited.
   * @param {string} roleName name of the role to file child roles for
   * @return {Promise<Map<string, Role>>} Child roles. The array is indexed by the role names. First element is an instance of the parent Role itself.
   * @throws {Error} if Role was not found that are getting by $roleName
   */
  getChildRoles(roleName: string): Promise<Map<string, Role>>;

  /**
   * Returns the named permission.
   * @param {string} name the permission name.
   * @return {Promise<Permission | null>} the permission corresponding to the specified name. Null is returned if no such permission.
   */
  getPermission(name: string): Promise<Permission | null>;

  /**
   * Returns all permissions in the system.
   * @return {Promise<Map<string, Permission>>} all permissions in the system. The array is indexed by the permission names.
   */
  getPermissions(): Promise<Map<string, Permission>>;

  /**
   * Returns all permissions that the specified role represents.
   * @param {string} roleName the role name
   * @return {Promise<Map<string, Permission>>} all permissions that the role represents. The array is indexed by the permission names.
   */
  getPermissionsByRole(roleName: string): Promise<Map<string, Permission>>;

  /**
   * Returns all permissions that the user has.
   * @param {string} username the username
   * @return {Promise<Map<string, Permission>>} all permissions that the user has. The array is indexed by the permission names.
   */
  getPermissionsByUser(username: string): Promise<Map<string, Permission>>;

  /**
   * Returns the rule of the specified name.
   * @param {string} name the rule name
   * @return {Promise<Rule | null>} the rule object, or null if the specified name does not correspond to a rule.
   */
  getRule(name: string): Promise<Rule | null>;

  /**
   * Returns all rules available in the system.
   * @return {Promise<Map<string, Rule>>} the rules indexed by the rule names
   */
  getRules(): Promise<Map<string, Rule>>;

  /**
   * Checks the possibility of adding a child to parent.
   * @param {Item} parent the parent item
   * @param {Item} child the child item to be added to the hierarchy
   * @return {Promise<boolean>} possibility of adding
   */
  canAddChild(parent: Item, child: Item): Promise<boolean>;

  /**
   * Adds an item as a child of another item.
   * @param {Item} parent
   * @param {Item} child
   * @return {Promise<boolean>} whether the child successfully added
   * @throws {Error} if the parent-child relationship already exists or if a loop has been detected.
   */
  addChild(parent: Item, child: Item): Promise<boolean>;

  /**
   * Removes a child from its parent.
   * Note, the child item is not deleted. Only the parent-child relationship is removed.
   * @param {Item} parent
   * @param {Item} child
   * @return {Promise<boolean>} whether the removal is successful
   */
  removeChild(parent: Item, child: Item): Promise<boolean>;

  /**
   * Remove all children from their parent.
   * Note, the children items are not deleted. Only the parent-child relationships are removed.
   * @param {Item} parent
   * @return {Promise<boolean>} whether the removal is successful
   */
  removeChildren(parent: Item): Promise<boolean>;

  /**
   * Returns a value indicating whether the child already exists for the parent.
   * @param {Item} parent
   * @param {Item} child
   * @return {Promise<boolean>}  whether `child` is already a child of `parent`
   */
  hasChild(parent: Item, child: Item): Promise<boolean>;

  /**
   * Returns the child permissions and/or roles.
   * @param {string} name the parent name
   * @return {Promise<Map<string, Item>>} the child permissions and/or roles
   */
  getChildren(name: string): Promise<Map<string, Item>>;

  /**
   * Assigns a role to a user.
   * @param {Role | Permission} role
   * @param {string} username the username
   * @return {Promise<Assignment>} the role assignment information.
   * @throws {Error} if the role has already been assigned to the user
   */
  assign(role: Role | Permission, username: string): Promise<Assignment>;

  /**
   * Revokes a role from a user.
   * @param {Role | Permission} role
   * @param {string} username the username
   * @return {Promise<boolean>} whether the revoking is successful
   */
  revoke(role: Role | Permission, username: string): Promise<boolean>;

  /**
   * Revokes all roles from a user.
   * @param {string} username the username
   * @return {Promise<boolean>} whether the revoking is successful
   */
  revokeAll(username: string): Promise<boolean>;

  /**
   * Returns the assignment information regarding a role and a user.
   * @param {string} roleName the role name
   * @param {string} username the username
   * @return {Promise<Assignment | null>} the assignment information. Null is returned if the role is not assigned to the user.
   */
  getAssignment(roleName: string, username: string): Promise<Assignment | null>;

  /**
   * Returns all role assignment information for the specified user.
   * @param {string} username the username
   * @return {Promise<Map<string, Assignment>>} the assignments indexed by role names. An empty array will be returned if there is no role assigned to the user.
   */
  getAssignments(username: string): Promise<Map<string, Assignment>>;

  /**
   * Returns all usernames assigned to the role specified.
   * @param {string} roleName
   * @return {Promise<string[]>} usernames
   */
  getUsernamesByRole(roleName: string): Promise<string[]>;

  /**
   * Removes all authorization data, including roles, permissions, rules, and assignments.
   */
  removeAll(): Promise<void>;

  /**
   * Removes all permissions.
   * All parent child relations will be adjusted accordingly.
   */
  removeAllPermissions(): Promise<void>;

  /**
   * Removes all roles.
   * All parent child relations will be adjusted accordingly.
   */
  removeAllRoles(): Promise<void>;

  /**
   * Removes all rules.
   * All roles and permissions which have rules will be adjusted accordingly.
   */
  removeAllRules(): Promise<void>;

  /**
   * Removes all role assignments.
   */
  removeAllAssignments(): Promise<void>;
}
