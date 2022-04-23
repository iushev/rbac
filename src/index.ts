import Rbac from "./Rbac";
import BaseManager, { BaseManagerOptions } from "./BaseManager";
import RbacUser, { Identity } from "./User";

export { Assignment } from "./Assignment";
export { ItemType, IItem, Role, Permission } from "./Item";
export { RuleParams, Rule, RuleExecuteFunction, RuleCtor } from "./Rule";
export { BaseCheckAccess, BaseCheckAccessOptions } from "./BaseCheckAccess";
export {
  default as checkAccess,
  CheckAccessOptions,
  RuleParamsFunction,
  MatchFunction,
} from "./middleware/checkAccess";
export { getRbac, RBACResponse } from "./middleware/getRbac";

export { default as testAuthManager } from "./tests/testAuthManager";

export { RbacUser, Identity, BaseManager, BaseManagerOptions };

declare global {
  namespace Express {
    export type User = RbacUser;

    export interface Request {
      authManager: BaseManager;
      user?: User;
    }
  }
}

const rbacManager = new Rbac();

export default rbacManager;
