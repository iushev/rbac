import { IItem, Rule, RuleParams } from "../..";

export interface ActionRuleData {
  action: string;
}
export class ActionRule extends Rule<ActionRuleData> {
  constructor(name = "action_rule", data?: ActionRuleData) {
    super(name, {
      action: "read",
      ...(data ?? {}),
    });
  }

  /**
   * @inheritdoc
   */
  public execute = async (_username: string, _item: IItem, params: RuleParams) => {
    return this.data.action === "all" || this.data.action === params["action"];
  };
}
