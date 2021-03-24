import Rbac from "./Rbac";
export { Assignment } from "./Assignment";
export { default as BaseManager, BaseManagerOptions } from "./BaseManager";
export { JsonManager, JsonManagerOptions } from "./JsonManager";
export { ItemType, Item, Role, Permission } from "./Item";
export { RuleParams, Rule, RuleExecuteFunction } from "./Rule";
export { default as User, Identity } from "./User";
export {
  default as checkAccess,
  CheckAccessOptions,
  RoleParams,
  RoleParamsFunction,
  MatchFunction,
} from "./middleware/checkAccess";

const rbacManager = new Rbac();

export default rbacManager;
