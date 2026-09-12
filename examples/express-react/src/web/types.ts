declare module "@iushev/rbac-react" {
  /**
   * The mirror of the `Express.RbacIdentity` augmentation on the server: what
   * the provider carries, and what `useRbacUser().identity` is typed as.
   */
  interface RbacIdentity {
    displayName: string;
  }
}

export {};
