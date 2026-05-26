import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/dashboard"];
const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED.some(p => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (accessToken) return NextResponse.next();

  if (refreshToken) {
    try {
      const apiBase = process.env.INTERNAL_API_URL ?? "http://fastapi:8000/api";
      const res = await fetch(`${apiBase}/v1/auth/refresh`, {
        method: "POST",
        headers: { Cookie: `${REFRESH_COOKIE}=${refreshToken}` },
      });
      if (res.ok) {
        const response = NextResponse.next();
        const setCookieHeader = res.headers.get("set-cookie");
        if (setCookieHeader) response.headers.set("set-cookie", setCookieHeader);
        return response;
      }
    } catch {
      // fall through to redirect
    }
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("session", "expired");
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
