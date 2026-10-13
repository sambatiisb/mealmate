import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const PROTECTED_PREFIXES = ["/home-choice", "/quad", "/preferences", "/app"];

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (isProtected && !req.auth) {
    const signInUrl = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(signInUrl);
  }

  if ((pathname === "/login" || pathname === "/signup") && req.auth) {
    return NextResponse.redirect(new URL("/home-choice", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
