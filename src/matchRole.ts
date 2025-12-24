import { RuleParams } from "./Rule";
import User from "./User";

export type CheckAccessOptions = {
  user: User;
  roles: string[];
  allow?: boolean;
  params?: RuleParams;
  logging?: false | ((...args: any[]) => void);
};

const matchRole = async (options: CheckAccessOptions) => {
  const { user, roles, allow = true, params = {}, logging = false } = options;
  if (!user || (!user.isGuest && !user.isActive)) {
    if (logging) {
      logging("User is either not provided or inactive");
    }
    return false;
  }

  if (roles.length === 0) {
    if (logging) {
      logging("No roles specified, access granted by default");
    }
    return true;
  }

  for (const role of roles) {
    if (role === "?" && user.isGuest && allow) {
      // only guest users
      if (logging) {
        logging("Role '?' matched: user is guest");
      }
      return true;
    } else if (role === "@" && !user.isGuest && allow) {
      // only authenticated users
      if (logging) {
        logging("Role '@' matched: user is authenticated");
      }
      return true;
    } else if ((await user.can({ permissionName: role, params, logging })) && allow) {
      // only authenticated users that has permission
      if (logging) {
        logging(`Role '${role}' matched: user has permission`);
      }
      return true;
    } else {
      continue;
    }
  }

  if (logging) {
    logging("No roles matched");
  }
  return false;
};

export default matchRole;
