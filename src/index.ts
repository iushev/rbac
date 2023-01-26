import BaseManager, { BaseManagerOptions } from "./BaseManager";
import Rbac from "./Rbac";
import RbacUser, { Identity } from "./User";

export { Assignment } from "./Assignment";
export { ItemType, IItem, ICreateItem, Role, Permission } from "./Item";
export { RuleParams, Rule, RuleExecuteFunction, RuleCtor } from "./Rule";
export { BaseCheckAccess, BaseCheckAccessOptions } from "./BaseCheckAccess";
export {
  default as checkAccess,
  CheckAccessOptions,
  RuleParamsFunction,
  MatchFunction,
} from "./middleware/checkAccess";
export { getRbac, RBACResponse } from "./middleware/getRbac";
export { RbacUser, Identity, BaseManager, BaseManagerOptions };

const rbacManager = new Rbac();
export default rbacManager;

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    export interface User extends RbacUser { }

    export interface Request {
      authManager: BaseManager;
      user?: User;
    }
  }
}
