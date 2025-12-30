import { RuleParams } from "./Rule";
import User from "./User";

export type CheckAccessOptions = {
  user: User;
  roles: string[];
  allow?: boolean;
  params?: RuleParams;
  logging?: (...args: any[]) => void;
};

const matchRole = async (options: CheckAccessOptions) => {
  const { user, roles, allow = true, params = {}, logging } = options;
  if (!user || (!user.isGuest && !user.isActive)) {
    logging?.("User is either not provided or inactive");
    return false;
  }

  if (roles.length === 0) {
    logging?.("No roles specified, access granted by default");
    return true;
  }

  for (const role of roles) {
    if (role === "?" && user.isGuest && allow) {
      // only guest users
      logging?.("Role '?' matched: user is guest");
      return true;
    } else if (role === "@" && !user.isGuest && allow) {
      // only authenticated users
      logging?.("Role '@' matched: user is authenticated");
      return true;
    } else if ((await user.can({ permissionName: role, params, logging })) && allow) {
      // only authenticated users that has permission
      logging?.(`Role '${role}' matched: user has permission`);

      return true;
    } else {
      continue;
    }
  }

  logging?.("No roles matched");
  return false;
};

export default matchRole;
