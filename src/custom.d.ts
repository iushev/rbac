declare namespace Express {
  interface User {
    identity: Identity | false;
    username: string | false;
    isActive: boolean;
    isSuperuser: boolean;
    isGuest: boolean;
    can(permissionName: string, params?: RuleParams, allowCaching?: boolean): Promise<boolean>;
  }

  interface Request {
    authManager: BaseManager;
    user: User;
  }
}
