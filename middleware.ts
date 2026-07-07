import { NextRequest, NextResponse } from "next/server";
import { verifySession, COOKIE } from "@/lib/auth";

// Protect /dashboard. Edge-compatible (jose verifies without DB).
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
