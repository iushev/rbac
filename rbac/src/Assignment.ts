/**
 * Assignment of an authorization item (normally a role) to a user.
 */
export interface Assignment {
  username: string;
  itemName: string;
}

export function createAssignment(username: string, itemName: string): Assignment {
  return { username, itemName };
}

export function cloneAssignment(assignment: Assignment): Assignment {
  return { ...assignment };
}
