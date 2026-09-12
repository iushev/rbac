import type { Logger } from "./CheckAccess.js";
import type { RuleParams } from "./Rule.js";
import type { Identity, RbacUser } from "./User.js";

export interface MatchRoleOptions<T extends Identity = Identity> {
  user: RbacUser<T>;
  /**
   * Role or permission names to match. Two names are special: `"?"` matches a
   * guest, `"@"` matches any authenticated user. An empty list matches everyone.
   */
  roles: string[];
  /** Set to false to invert the outcome, for deny rules. */
  allow?: boolean;
  params?: RuleParams;
  logging?: Logger;
}

/**
 * Whether a user matches any of a list of roles.
 *
 * Convenience over {@link RbacUser.can} for the common "this screen or route is
 * open to these roles" check.
 */
export async function matchRole<T extends Identity = Identity>({
  user,
  roles,
  allow = true,
  params = {},
  logging,
}: MatchRoleOptions<T>): Promise<boolean> {
  if (!user.isGuest && !user.isActive) {
    logging?.("matchRole: user is inactive");
    return false;
  }

  if (roles.length === 0) {
    logging?.("matchRole: no roles specified, matched by default");
    return allow;
  }

  for (const role of roles) {
    if (role === "?" && user.isGuest) {
      logging?.("matchRole: '?' matched, user is a guest");
      return allow;
    }

    if (role === "@" && !user.isGuest) {
      logging?.("matchRole: '@' matched, user is authenticated");
      return allow;
    }

    if (await user.can({ permissionName: role, params, logging })) {
      logging?.(`matchRole: '${role}' matched`);
      return allow;
    }
  }

  logging?.("matchRole: no roles matched");
  return !allow;
}

export default matchRole;
