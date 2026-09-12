import type { CheckAccess, Logger } from "./CheckAccess.js";
import type { RuleParams } from "./Rule.js";

/** The minimum an application's user object has to expose to RBAC. */
export interface Identity {
  username: string;
  isActive: boolean;
  isSuperuser: boolean;
}

export interface CanArgs {
  permissionName: string;
  params?: RuleParams;
  /** Memoize the result. Ignored when `params` is non-empty. */
  allowCaching?: boolean;
  logging?: Logger;
}

/**
 * Binds an identity to an access checker, so application code asks
 * `user.can("updatePost")` instead of threading a username everywhere.
 *
 * Framework-neutral: it holds no request or session state, which is what lets
 * the same class run on a server and in a web / React Native app.
 */
export class RbacUser<T extends Identity = Identity> {
  private _identity: T | null = null;
  private readonly accessCache = new Map<string, boolean>();
  private readonly accessChecker: CheckAccess;

  constructor(accessChecker: CheckAccess, identity: T | null = null) {
    this.accessChecker = accessChecker;
    this._identity = identity;
  }

  public get identity(): T | null {
    return this._identity;
  }

  /** Setting a new identity clears the memoized access results. */
  public set identity(identity: T | null) {
    this._identity = identity;
    this.accessCache.clear();
  }

  public get username(): string {
    return this._identity?.username ?? "guest";
  }

  public get isActive(): boolean {
    return this._identity?.isActive ?? true;
  }

  public get isSuperuser(): boolean {
    return this._identity?.isSuperuser ?? false;
  }

  public get isGuest(): boolean {
    return this._identity === null;
  }

  /** Drops the memoized access results, e.g. after the authorization data changed. */
  public clearAccessCache(): void {
    this.accessCache.clear();
  }

  /**
   * Whether the user holds `permissionName`.
   *
   * An inactive user is denied everything and a superuser is granted
   * everything, both without consulting the store. Results are memoized only
   * for parameterless checks, since a rule's answer depends on its params.
   */
  public async can({ permissionName, params = {}, allowCaching = true, logging }: CanArgs): Promise<boolean> {
    if (!this.isGuest && !this.isActive) {
      return false;
    }

    if (this.isSuperuser) {
      return true;
    }

    const cacheable = allowCaching && Object.keys(params).length === 0;
    if (cacheable) {
      const cached = this.accessCache.get(permissionName);
      if (cached !== undefined) {
        return cached;
      }
    }

    const access = await this.accessChecker.checkAccess({
      username: this.username,
      itemName: permissionName,
      params,
      logging,
    });

    if (cacheable) {
      this.accessCache.set(permissionName, access);
    }

    return access;
  }
}
