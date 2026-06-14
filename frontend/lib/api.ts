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

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: { message: "Unknown error", code: "unknown" } }));
    const detail: ApiError =
      typeof body.detail === "object"
        ? body.detail
        : { message: body.detail ?? "Request failed", code: "error" };
    throw new HttpError(res.status, detail);
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
