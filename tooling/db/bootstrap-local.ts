import { Client } from 'pg';

const url = 'postgresql://sigac:sigac_dev_only@localhost:5432/sigac_demo';

async function main() {
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS bootstrap_status (
      id integer PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.query(`INSERT INTO bootstrap_status(id) VALUES (1) ON CONFLICT DO NOTHING`);
  await client.end();
  console.log('Local DB reachable. Generate/review/apply formal migrations next.');
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
