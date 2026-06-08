require("dotenv").config({ quiet: true });
const { Client } = require("pg");

async function main() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const tables = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `);
  const types = await client.query(`
    select coalesce(type, 'NULL') as type, count(*)::int as count
    from public.hadith
    group by type
    order by type
  `);
  console.log("tables=" + tables.rows.map((row) => row.table_name).join(","));
  console.log("hadith_types=" + types.rows.map((row) => `${row.type}:${row.count}`).join(","));
  await client.end();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
