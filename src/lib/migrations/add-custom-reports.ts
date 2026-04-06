import postgres from 'postgres'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function migrate() {
  const url = process.env.DATABASE_URL_DIRECT
  if (!url) throw new Error('DATABASE_URL_DIRECT not set')

  const match = url.match(/postgresql:\/\/([^:]+):(.+)@([^:]+):(\d+)\/(.+)/)
  if (!match) throw new Error('Cannot parse DATABASE_URL_DIRECT')

  const sql = postgres({
    host: match[3],
    port: Number(match[4]),
    database: match[5],
    username: match[1],
    password: match[2],
    prepare: false,
  })

  console.log('Creating custom_reports table...')
  await sql`
    CREATE TABLE IF NOT EXISTS custom_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id UUID NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      config JSONB NOT NULL,
      is_shared BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `

  console.log('Creating saved_views table...')
  await sql`
    CREATE TABLE IF NOT EXISTS saved_views (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id UUID NOT NULL,
      page_key TEXT NOT NULL,
      name TEXT NOT NULL,
      filters JSONB NOT NULL,
      sort_by TEXT,
      sort_direction TEXT,
      is_shared BOOLEAN NOT NULL DEFAULT false,
      is_default BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `

  console.log('Creating indexes...')
  await sql`CREATE INDEX IF NOT EXISTS idx_custom_reports_tenant ON custom_reports(tenant_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_custom_reports_user ON custom_reports(tenant_id, user_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_saved_views_tenant ON saved_views(tenant_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_saved_views_page ON saved_views(tenant_id, page_key)`

  console.log('Enabling RLS...')
  await sql`ALTER TABLE custom_reports ENABLE ROW LEVEL SECURITY`
  await sql`ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY`

  console.log('Creating RLS policies...')
  await sql`
    DO $$ BEGIN
      CREATE POLICY "custom_reports_tenant_isolation" ON custom_reports
        FOR ALL USING (
          tenant_id = (SELECT (raw_app_meta_data->>'tenant_id')::uuid FROM auth.users WHERE id = auth.uid())
        );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `

  await sql`
    DO $$ BEGIN
      CREATE POLICY "saved_views_tenant_isolation" ON saved_views
        FOR ALL USING (
          tenant_id = (SELECT (raw_app_meta_data->>'tenant_id')::uuid FROM auth.users WHERE id = auth.uid())
        );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `

  console.log('Migration complete: custom_reports + saved_views tables created')
  await sql.end()
}

migrate().catch(console.error)
