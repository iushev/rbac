declare namespace Express {
  export interface User {
    identity: Identity | false;
    username: string | false;
    isActive: boolean;
    isSuperuser: boolean;
    isGuest: boolean;
    can(permissionName: string, params?: RuleParams, allowCaching?: boolean): Promise<boolean>;
  }

  export interface Request {
    authManager: BaseManager;
    user: User;
  }
}
