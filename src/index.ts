import BaseManager, { BaseManagerOptions } from "./BaseManager";
import Rbac from "./Rbac";
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
export { RbacUser, Identity, BaseManager, BaseManagerOptions };

const rbacManager = new Rbac();
export default rbacManager;
