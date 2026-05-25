const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

/**
 * Origin URL of the backend (no `/api/v1` suffix). Useful for building URLs
 * to static assets like uploaded images, which the backend serves from /uploads/*.
 */
export const BACKEND_ORIGIN = BASE_URL.replace(/\/api(\/v\d+)?\/?$/, "");

/** Build an absolute URL to a backend-served file path like "/uploads/vehicles/abc.jpg". */
export const fileUrl = (path: string): string => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${BACKEND_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
};

const ACCESS_KEY = "cdms.accessToken";
const REFRESH_KEY = "cdms.refreshToken";

export const tokenStorage = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export interface ApiEnvelope<T> {
  success: boolean;
  statusCode: number;
  message: string | string[];
  data: T;
  timestamp: string;
}

export class ApiError extends Error {
  constructor(public statusCode: number, message: string, public payload?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface RequestOptions {
  method?: Method;
  body?: unknown;
  /** When true, body is sent as-is (FormData). Caller manages Content-Type. */
  rawBody?: boolean;
  auth?: boolean;
  signal?: AbortSignal;
  query?: Record<string, string | number | boolean | undefined | null>;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  if (!query) return `${BASE_URL}${path}`;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    params.append(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${BASE_URL}${path}?${qs}` : `${BASE_URL}${path}`;
}

let refreshPromise: Promise<boolean> | null = null;
let onAuthFailure: (() => void) | null = null;

export const setAuthFailureHandler = (handler: (() => void) | null) => {
  onAuthFailure = handler;
};

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  const refreshToken = tokenStorage.getRefresh();
  if (!refreshToken) return false;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const env = (await res.json()) as ApiEnvelope<{ accessToken: string; refreshToken: string }>;
      if (!env?.data?.accessToken || !env?.data?.refreshToken) return false;
      tokenStorage.set(env.data.accessToken, env.data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function rawRequest<T>(path: string, opts: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {};
  if (!opts.rawBody) headers["Content-Type"] = "application/json";
  if (opts.auth !== false) {
    const token = tokenStorage.getAccess();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const body =
    opts.body === undefined
      ? undefined
      : opts.rawBody
        ? (opts.body as BodyInit)
        : JSON.stringify(opts.body);

  const res = await fetch(buildUrl(path, opts.query), {
    method: opts.method ?? "GET",
    headers,
    body,
    signal: opts.signal,
  });

  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await res.json()) as ApiEnvelope<T>;
  } catch {
    // non-JSON response (rare); fall through
  }

  if (!res.ok) {
    const message = Array.isArray(envelope?.message)
      ? envelope!.message.join(", ")
      : envelope?.message ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message, envelope);
  }

  return envelope?.data as T;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, opts);
  } catch (err) {
    if (
      err instanceof ApiError &&
      err.statusCode === 401 &&
      opts.auth !== false &&
      tokenStorage.getRefresh()
    ) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return await rawRequest<T>(path, opts);
      }
      tokenStorage.clear();
      onAuthFailure?.();
    }
    throw err;
  }
}
