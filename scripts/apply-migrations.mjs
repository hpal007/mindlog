// Apply supabase/all_migrations.sql to the Supabase Postgres.
// Run: node --env-file=.env.local scripts/apply-migrations.mjs
import { readFileSync } from "node:fs";
import pg from "pg";

const ref = process.env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)[1];
const password = process.env.SUPABASE_DB_PASSWORD;
const sql = readFileSync("supabase/all_migrations.sql", "utf8");

// Candidate connections: direct first, then session-pooler across regions and
// both pooler prefixes (newer projects use aws-1-..., older aws-0-...).
const regions = [
  "ap-south-1", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2",
  "us-east-1", "us-east-2", "us-west-1", "us-west-2", "ca-central-1", "sa-east-1",
  "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-central-2", "eu-north-1",
];
const candidates = [
  { name: "direct", host: `db.${ref}.supabase.co`, port: 5432, user: "postgres" },
];
for (const prefix of ["aws-0", "aws-1"]) {
  for (const r of regions) {
    candidates.push({
      name: `${prefix}-${r}`, host: `${prefix}-${r}.pooler.supabase.com`,
      port: 5432, user: `postgres.${ref}`,
    });
  }
}

async function tryConn(c) {
  const client = new pg.Client({
    host: c.host, port: c.port, user: c.user, password, database: "postgres",
    ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000,
  });
  await client.connect();
  return client;
}

let client = null, used = null;
for (const c of candidates) {
  try {
    client = await tryConn(c);
    used = c;
    break;
  } catch (e) {
    console.log(`[${c.name}] ${c.host} -> ${(e.message || "").slice(0, 60)}`);
  }
}
if (!client) {
  console.error("Could not connect to Postgres on any candidate host.");
  process.exit(1);
}
console.log(`Connected via ${used.name} (${used.host}). Applying migrations...`);
try {
  await client.query(sql); // multi-statement simple query = one implicit transaction
  console.log("Migrations applied successfully.");
  const { rows } = await client.query(
    "select count(*)::int as n from coping_exercises where status='active'",
  );
  console.log(`coping_exercises (active): ${rows[0].n}`);
  const { rows: t } = await client.query(
    "select table_name from information_schema.tables where table_schema='public' order by table_name",
  );
  console.log("public tables:", t.map((r) => r.table_name).join(", "));
} catch (e) {
  console.error("Migration error:", e.message);
  process.exit(2);
} finally {
  await client.end();
}
