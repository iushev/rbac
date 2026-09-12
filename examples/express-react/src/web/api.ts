import type { ApiErrorBody } from "../shared/api.js";

const TOKEN_KEY = "rbac-demo-token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token === null) {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

/** A failed request, with the status the guards produced kept intact. */
export class ApiError extends Error {
  public readonly status: number;
  public readonly required: string[];

  constructor(status: number, message: string, required: string[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.required = required;
  }

  /** True when the request failed because the user is not signed in. */
  public get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** True when the user is signed in but the guard refused them. */
  public get isForbidden(): boolean {
    return this.status === 403;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(init?.body === undefined ? {} : { "content-type": "application/json" }),
      ...(token === null ? {} : { authorization: `Bearer ${token}` }),
      ...init?.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const body = (payload ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(response.status, body.error ?? response.statusText, body.required ?? []);
  }

  return payload as T;
}
