import BaseCheckAccess from "./BaseCheckAccess";
import { Item } from "./Item";

export type RuleParams = {
  [key: string]: any;
};

export type RuleExecuteFunction = (username: string, item: Item, params: RuleParams) => Promise<boolean>;

export class Rule<RuleData extends {} = any> {
  public name!: string;
  public data!: RuleData;

  constructor(name: string = "", data?: RuleData) {
    this.name = name;
    this.data = data ?? ({} as RuleData);
  }

  public static init(checkAccess: BaseCheckAccess) {
    checkAccess.ruleClasses.set(this.name, this);
    return this;
  }

  execute: RuleExecuteFunction = async (_username: string, _item: Item, _params: RuleParams) => true;
}

export type RuleType = typeof Rule;

export type RuleCtor<R extends Rule> = typeof Rule & { new (): R };
