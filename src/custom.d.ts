import RbacUser from "./User";

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    export interface User extends RbacUser {}
  }
}
