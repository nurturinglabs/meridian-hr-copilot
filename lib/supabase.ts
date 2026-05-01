import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Pool, PoolClient } from 'pg'

// Env vars are read lazily inside each factory so scripts can call dotenv.config()
// before invoking these functions (ES `import` is hoisted above top-level code).

export function createAnonClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set')
  }
  return createClient(url, anonKey)
}

export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

let pool: Pool | null = null
function getPool(): Pool {
  const dbUrl = process.env.SUPABASE_DB_URL
  if (!dbUrl) {
    throw new Error('SUPABASE_DB_URL must be set for withPersona() — see .env.local.example')
  }
  if (!pool) {
    pool = new Pool({ connectionString: dbUrl, max: 5 })
  }
  return pool
}

// Open a transaction, scope app.mhr_persona for the transaction's lifetime, run fn,
// commit (or rollback on throw). RLS policies in 0001_init.sql read this GUC.
export async function withPersona<T>(
  persona: 'employee' | 'hr_admin' | 'executive',
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    await client.query(`select set_config('app.mhr_persona', $1, true)`, [persona])
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}
