const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export interface ApiError {
  message: string;
  code: string;
}

export class HttpError extends Error {
  constructor(public status: number, public detail: ApiError) {
    super(detail.message);
  }
}

// Auth paths that must NOT trigger a refresh-and-retry:
// - /refresh would loop; login/signup/reset return 401 for bad input, not expiry.
const NO_REFRESH_PATHS = [
  "/v1/auth/refresh",
  "/v1/auth/login",
  "/v1/auth/signup",
  "/v1/auth/reset-password",
];

function doFetch(path: string, options: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
}

// De-dupe concurrent refreshes: a burst of expired requests refreshes only once.
let refreshInFlight: Promise<boolean> | null = null;

function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doFetch("/v1/auth/refresh", { method: "POST" })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const canRefresh = !NO_REFRESH_PATHS.some((p) => path.startsWith(p));

  let res = await doFetch(path, options);

  // Access token (30 min) likely expired — refresh once using the 7-day
  // refresh cookie and retry the original request.
  if (res.status === 401 && canRefresh) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await doFetch(path, options);
    }
  }

  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({ detail: { message: "Unknown error", code: "unknown" } }));
    const detail: ApiError =
      typeof body.detail === "object"
        ? body.detail
        : { message: body.detail ?? "Request failed", code: "error" };

    // Still unauthorized after a refresh attempt → session is truly gone.
    // Send the user to login (guarded so we never loop on the login page).
    if (
      res.status === 401 &&
      canRefresh &&
      typeof window !== "undefined" &&
      window.location.pathname !== "/login"
    ) {
      window.location.href = "/login";
    }
    throw new HttpError(res.status, detail);
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
