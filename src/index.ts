import Rbac from "./Rbac";
import RbacUser, { Identity } from "./User";
import BaseManager, { BaseManagerOptions } from "./BaseManager";

export { Assignment } from "./Assignment";
export { ItemType, Item, Role, Permission } from "./Item";
export { RuleParams, Rule, RuleExecuteFunction, RuleCtor } from "./Rule";
export { CheckAccess } from "./CheckAccess";
export {
  default as checkAccess,
  CheckAccessOptions,
  RoleParams,
  RoleParamsFunction,
  MatchFunction,
} from "./middleware/checkAccess";
export { getRbac, RBACResponse } from "./middleware/getRbac";

export { default as testAuthManager } from "./testAuthManager";

export { RbacUser, Identity, BaseManager, BaseManagerOptions };

declare global {
  namespace Express {
    export interface User extends RbacUser {}

    export interface Request {
      authManager: BaseManager;
      user?: User;
    }
  }
}

const rbacManager = new Rbac();

export default rbacManager;
