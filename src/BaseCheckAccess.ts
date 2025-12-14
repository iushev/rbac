import { Assignment } from "./Assignment";
import { IItem } from "./Item";
import { RuleCtor, Rule, RuleParams } from "./Rule";

export type BaseCheckAccessOptions = {
  defaultRoles?: string[];
  logging?: false | ((...args: any[]) => void);
};

export class BaseCheckAccess {
  /**
   * @inheritdoc
   */
  public readonly ruleClasses: Map<string, RuleCtor<Rule<any>>> = new Map();

  /**
   * @inheritdoc
   */
  public readonly defaultRoles: string[];

  /**
   * @inheritdoc
   */
  protected items: Map<string, IItem> = new Map();

  /**
   * @inheritdoc
   */
  protected parents: Map<string, Map<string, IItem>> = new Map();

  /**
   * @inheritdoc
   */
  protected rules: Map<string, Rule<any>> = new Map();

  // /**
  //  * @inheritdoc
  //  */
  // protected assignments: Map<string, Map<string, Assignment>> = new Map();

  /**
   * @inheritdoc
   */
  protected logging: false | ((...args: any[]) => void);

  /**
   *
   * @param options
   */
  constructor(options?: BaseCheckAccessOptions) {
    this.defaultRoles = options?.defaultRoles ?? ["guest"];
    this.logging = options?.logging ?? false;
  }

  /**
   * @param args
   */
  protected log(...args: any[]) {
    if (this.logging) {
      this.logging(...args);
    }
  }

  /**
   * Performs access check for the specified user.
   * @param {string} username the user ID. This should can be either an integer or a string representing
   * the unique identifier of a user.
   * @param {string} itemName the name of the operation that need access check
   * @param {RuleParams} params name-value pairs that would be passed to rules associated
   * with the tasks and roles assigned to the user. A param with name 'user' is added to this array,
   * which holds the value of userId.
   * @param {Map<string, Assignment>} assignments the assignments to the specified user
   * @return {boolean} whether the operations can be performed by the user.
   */
  public async checkAccess(
    username: string,
    itemName: string,
    params: RuleParams,
    assignments: Map<string, Assignment>,
  ): Promise<boolean> {
    const item = this.items.get(itemName);

    if (!item) {
      return false;
    }

    if (!(await this.executeRule(username, item, params))) {
      return false;
    }

    if (assignments.has(itemName) || this.defaultRoles.includes(itemName)) {
      return true;
    }

    const parents = this.parents.get(itemName);
    if (parents && parents.size > 0) {
      for (const parentName of parents.keys()) {
        if (await this.checkAccess(username, parentName, params, assignments)) {
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
  protected async executeRule(username: string, item: IItem, params: RuleParams): Promise<boolean> {
    if (!item.ruleName) {
      return true;
    }

    const rule = this.rules.get(item.ruleName);

    if (!rule) {
      throw new Error(`Rule "${item.ruleName}" does not exists. Or rules does not loaded.`);
    }

    return rule.execute(username, item, params);
  }
}

export default BaseCheckAccess;
