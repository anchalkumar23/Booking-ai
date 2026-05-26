import { apiFetch, HttpError } from "./api";

export interface MeResponse {
  id: string;
  email: string;
  full_name: string;
}

export async function login(email: string, password: string): Promise<void> {
  await apiFetch("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(): Promise<void> {
  await apiFetch("/v1/auth/logout", { method: "POST" });
}

export async function refreshToken(): Promise<boolean> {
  try {
    await apiFetch("/v1/auth/refresh", { method: "POST" });
    return true;
  } catch {
    return false;
  }
}

export async function getMe(): Promise<MeResponse | null> {
  try {
    return await apiFetch<MeResponse>("/v1/auth/me");
  } catch {
    return null;
  }
}
