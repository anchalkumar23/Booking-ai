import { NextRequest, NextResponse } from "next/server";

const AUTH_REQUIRED = ["/dashboard", "/select-location"];
const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";
const ACTIVE_LOCATION_COOKIE = "active_location_id";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = AUTH_REQUIRED.some(p => pathname.startsWith(p));
  if (!needsAuth) return NextResponse.next();

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  let authenticated = !!accessToken;

  if (!authenticated && refreshToken) {
    try {
      const apiBase = process.env.INTERNAL_API_URL ?? "http://fastapi:8000/api";
      const res = await fetch(`${apiBase}/v1/auth/refresh`, {
        method: "POST",
        headers: { Cookie: `${REFRESH_COOKIE}=${refreshToken}` },
      });
      if (res.ok) {
        authenticated = true;
        if (pathname.startsWith("/dashboard")) {
          const activeLocation = request.cookies.get(ACTIVE_LOCATION_COOKIE)?.value;
          if (!activeLocation) {
            return NextResponse.redirect(new URL("/select-location", request.url));
          }
        }
        const response = NextResponse.next();
        const setCookieHeader = res.headers.get("set-cookie");
        if (setCookieHeader) response.headers.set("set-cookie", setCookieHeader);
        return response;
      }
    } catch {
      // fall through to redirect
    }
  }

  if (!authenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("session", "expired");
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/dashboard") && !request.cookies.get(ACTIVE_LOCATION_COOKIE)?.value) {
    return NextResponse.redirect(new URL("/select-location", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/select-location"],
};
