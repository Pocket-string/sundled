import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, string> = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.1.0',
  }

  // DB connectivity check
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (supabaseUrl && supabaseKey) {
      const res = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: { apikey: supabaseKey },
        signal: AbortSignal.timeout(3000),
      })
      checks.database = res.ok ? 'connected' : 'error'
    } else {
      checks.database = 'not_configured'
    }
  } catch {
    checks.database = 'unreachable'
  }

  const isHealthy = checks.database !== 'unreachable'
  return NextResponse.json(checks, { status: isHealthy ? 200 : 503 })
}
