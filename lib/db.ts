import { neon } from "@neondatabase/serverless";

// Single Neon client (HTTP driver — works in serverless / edge, no backend server needed)
if (!process.env.DATABASE_URL) {
  // Don't throw at import time during build; route handlers will surface the error.
  console.warn("DATABASE_URL is not set");
}

export const sql = neon(process.env.DATABASE_URL || "");

export type DbUser = { id: number; username: string; password_hash: string };
