import { RuleParams } from "./Rule";
import User from "./User";

export type CheckAccessOptions = {
  user: User;
  roles: string[];
  allow?: boolean;
  params?: RuleParams;
};

const matchRole = async (options: CheckAccessOptions) => {
  const { user, roles, allow = true, params = {} } = options;

  if (!user || (!user.isGuest && !user.isActive)) {
    return false;
  }

  if (roles.length === 0) {
    return true;
  }

  for (const role of roles) {
    if (role === "?" && user.isGuest && allow) {
      // only guest users
      return true;
    } else if (role === "@" && !user.isGuest && allow) {
      // only authenticated users
      return true;
    } else if ((await user.can({ permissionName: role, params })) && allow) {
      // only authenticated users that has permission
      return true;
    } else {
      continue;
    }
  }

  return false;
};

export default matchRole;
