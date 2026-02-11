import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'
import postgres from 'postgres'

/**
 * Database Client Configuration
 *
 * IMPORTANT: prepare: false is required because Supabase uses PgBouncer
 * in transaction mode, which does not support prepared statements.
 */
const connectionString = process.env.DATABASE_URL!

const client = postgres(connectionString, {
  prepare: false, // Required for PgBouncer transaction mode
  max: 1, // Single connection for serverless
  idle_timeout: 20, // Close idle connections quickly
})

export const db = drizzle(client, { schema })
