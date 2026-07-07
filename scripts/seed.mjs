// Seed Neon: create tables, insert the analysis JSON, create an admin user.
// Usage:  DATABASE_URL=... node scripts/seed.mjs     (or set it in .env and use a loader)
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to your environment / .env first.");
  process.exit(1);
}
const sql = neon(url);

const adminUser = process.env.SEED_ADMIN_USER || "admin";
const adminPass = process.env.SEED_ADMIN_PASSWORD || "admin123";

async function main() {
  console.log("Creating tables ...");
  await sql`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS analysis (
    id SERIAL PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
  )`;

  console.log("Loading analysis JSON ...");
  const data = JSON.parse(readFileSync(join(__dirname, "dashboard_data.json"), "utf8"));
  // keep a single latest row
  await sql`DELETE FROM analysis`;
  await sql`INSERT INTO analysis (data) VALUES (${JSON.stringify(data)}::jsonb)`;
  console.log("  analysis row inserted.");

  console.log(`Creating admin user "${adminUser}" ...`);
  const hash = await bcrypt.hash(adminPass, 10);
  await sql`
    INSERT INTO users (username, password_hash) VALUES (${adminUser}, ${hash})
    ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
  `;
  console.log(`  done. Login with  ${adminUser} / ${adminPass}`);
  console.log("Seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
