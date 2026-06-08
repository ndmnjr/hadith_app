require("dotenv").config({ quiet: true });
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

async function main() {
  const migration = process.argv[2] || "supabase/migrations/20260608_mvp_schema_rpc.sql";
  const sql = fs.readFileSync(path.join(__dirname, "..", migration), "utf8");
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log(`applied ${migration}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
