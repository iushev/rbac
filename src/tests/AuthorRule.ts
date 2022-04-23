import { IItem, Rule, RuleParams } from "../..";

export interface AuthorRuleData {
  reallyReally: boolean;
}

export class AuthorRule extends Rule<AuthorRuleData> {
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
