import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './packages/platform/database/src/schema/tenant.ts',
  out: './migrations/tenant',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://sigac:sigac_dev_only@localhost:5432/sigac_demo',
  },
});
