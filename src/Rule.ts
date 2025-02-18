import BaseCheckAccess from "./BaseCheckAccess";
import { IItem } from "./Item";

export type RuleParams = Record<string, any>;
export type RuleData = Record<string, any>;
export type RuleExecuteFunction = (username: string, item: IItem, params: RuleParams) => Promise<boolean>;

export class Rule<TData extends RuleData = Record<string, unknown>> {
  public name: string;
  public data: TData;

  constructor(name = "", data?: TData) {
    this.name = name;
    this.data = data ?? ({} as TData);
  }

  public static init(checkAccess: BaseCheckAccess) {
    checkAccess.ruleClasses.set(this.name, this);
    return this;
  }

  execute: RuleExecuteFunction = async (_username: string, _item: IItem, _params: RuleParams) => true;
}

export type RuleType = typeof Rule;

export type RuleCtor<R extends Rule> = typeof Rule & { new (): R };
