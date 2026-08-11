const buckets = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, maxRequests: number, windowMs: number): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = buckets.get(key)

  if (!entry || entry.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: maxRequests - 1, resetAt: now + windowMs }
  }

  if (entry.count >= maxRequests) {
    return { ok: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { ok: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt }
}

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of buckets) {
      if (entry.resetAt < now) buckets.delete(key)
    }
  }, 5 * 60 * 1000).unref?.()
}
