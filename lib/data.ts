import { sql } from "./db";

export async function getAnalysis(): Promise<any | null> {
  try {
    const rows = (await sql`SELECT data FROM analysis ORDER BY id DESC LIMIT 1`) as {
      data: any;
    }[];
    return rows[0]?.data ?? null;
  } catch (e) {
    console.error("getAnalysis failed", e);
    return null;
  }
}
