/**
 * In-memory sliding window rate limiter.
 * Tracks requests per key (user ID) within a time window.
 */

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

// Cleanup stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanup(windowMs: number) {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  const cutoff = now - windowMs
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff)
    if (entry.timestamps.length === 0) store.delete(key)
  }
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetInSeconds: number
}

export function checkRateLimit(
  key: string,
  maxRequests: number = 30,
  windowMs: number = 60 * 60 * 1000 // 1 hour
): RateLimitResult {
  cleanup(windowMs)

  const now = Date.now()
  const cutoff = now - windowMs
  const entry = store.get(key) ?? { timestamps: [] }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff)

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0]
    const resetInSeconds = Math.ceil((oldestInWindow + windowMs - now) / 1000)
    return { allowed: false, remaining: 0, resetInSeconds }
  }

  entry.timestamps.push(now)
  store.set(key, entry)

  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    resetInSeconds: Math.ceil(windowMs / 1000),
  }
}
