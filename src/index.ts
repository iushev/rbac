import Rbac from "./Rbac";
import RbacUser, { Identity } from "./User";
import BaseManager, { BaseManagerOptions } from "./BaseManager";

export { Assignment } from "./Assignment";
export { JsonManager, JsonManagerOptions } from "./JsonManager";
export { ItemType, Item, Role, Permission } from "./Item";
export { RuleParams, Rule, RuleExecuteFunction } from "./Rule";
export {
  default as checkAccess,
  CheckAccessOptions,
  RoleParams,
  RoleParamsFunction,
  MatchFunction,
} from "./middleware/checkAccess";

export { RbacUser as User, Identity, BaseManager, BaseManagerOptions };

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
