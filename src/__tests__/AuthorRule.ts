import { IItem } from "../Item";
import { Rule, RuleParams } from "../Rule";

export interface AuthorRuleData {
  reallyReally: boolean;
}

export default class AuthorRule extends Rule<AuthorRuleData> {
  constructor(name = "isAuthor", data?: AuthorRuleData) {
    super(name, {
      reallyReally: false,
      ...(data ?? {}),
    });
  }

  /**
   * @inheritdoc
   */
  public execute = async (username: string, _item: IItem, params: RuleParams) => {
    return params["authorId"] === username;
  };
}
