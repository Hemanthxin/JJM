import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql, DbUser } from "@/lib/db";
import { createSession, COOKIE } from "@/lib/auth";

export const runtime = "nodejs"; // bcrypt needs Node runtime

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
    }
    const rows = (await sql`
      SELECT id, username, password_hash FROM users WHERE username = ${username} LIMIT 1
    `) as DbUser[];
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }
    const token = await createSession(user.username);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Login failed" }, { status: 500 });
  }
}
