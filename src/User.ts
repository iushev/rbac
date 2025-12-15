import BaseManager from "./BaseManager";
import { RuleParams } from "./Rule";

export interface Identity {
  username: string;
  isActive: boolean;
  isSuperuser: boolean;
}

export default class User<T extends Identity = Identity> {
  private _identity: T | null = null;
  private access: { [key: string]: boolean } = {};
  private accessChecker: BaseManager;

  constructor(accessChecker: BaseManager) {
    this.accessChecker = accessChecker;
  }

  set identity(identity: T | null) {
    if (!identity) {
      this._identity = null;
      return;
    }

    this._identity = identity;
  }

  get identity() {
    return this._identity;
  }

  get username() {
    return this._identity?.username ?? "guest";
  }

  get isActive() {
    return this._identity?.isActive ?? true;
  }

  get isSuperuser() {
    return this._identity?.isSuperuser ?? false;
  }

  get isGuest() {
    return this._identity === null;
  }

  async can(permissionName: string, params: RuleParams = {}, allowCaching = true): Promise<boolean> {
    if (!this.isGuest && !this.isActive) {
      return false;
    }

    if (this.isSuperuser) {
      return true;
    }

    if (allowCaching && Object.keys(params).length === 0 && this.access[permissionName]) {
      return this.access[permissionName];
    }

    const access = await this.accessChecker.checkAccess(this.username, permissionName, params);

    if (allowCaching && params.length === 0) {
      this.access[permissionName] = access;
    }

    return access;
  }
}
