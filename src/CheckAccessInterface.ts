import { RuleParams } from "./Rule";

/**
 * For more details and usage information on CheckAccessInterface, see the [guide article on security authorization](guide:security-authorization).
 */
export interface CheckAccessInterface {
  /**
   * Checks if the user has the specified permission.
   * @param {string} username the user ID. This should be either an integer or a string representing
   * the unique identifier of a user.
   * @param {string} permissionName the name of the permission to be checked against
   * @param {RuleParams} params name-value pairs that will be passed to the rules associated
   * with the roles and permissions assigned to the user.
   * @return {Promise<boolean>} whether the user has the specified permission.
   * @throws {InvalidParamException} if permissionName does not refer to an existing permission
   */
  checkAccess(username: string, permissionName: string, params: RuleParams): Promise<boolean>;
}
