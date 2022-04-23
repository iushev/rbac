import BaseCheckAccess from "./BaseCheckAccess";
import { IItem } from "./Item";

export type RuleParams = {
  [key: string]: any;
};

export type RuleExecuteFunction = (username: string, item: IItem, params: RuleParams) => Promise<boolean>;

export class Rule<RuleData extends Record<string, any> = Record<string, never>> {
  public name: string;
  public data: RuleData;

  constructor(name = "", data?: RuleData) {
    this.name = name;
    this.data = data ?? ({} as RuleData);
  }

  public static init(checkAccess: BaseCheckAccess) {
    checkAccess.ruleClasses.set(this.name, this);
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  execute: RuleExecuteFunction = async (_username: string, _item: IItem, _params: RuleParams) => true;
}

export type RuleType = typeof Rule;

export type RuleCtor<R extends Rule> = typeof Rule & { new (): R };
