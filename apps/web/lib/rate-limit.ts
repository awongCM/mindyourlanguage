const WINDOW_MS = 60_000

type Bucket = {
  timestamps: number[]
}

const buckets = new Map<string, Bucket>()

function getLimit(): number {
  const raw = process.env.RATE_LIMIT_PER_MIN
  const parsed = raw ? Number.parseInt(raw, 10) : 20
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20
}

/** First client IP from x-forwarded-for (Render/appends the real client). */
export function clientIpFromForwardedFor(header: string | null): string {
  if (!header) return 'anonymous'
  return header.split(',')[0]?.trim() || 'anonymous'
}

function pruneExpiredBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < WINDOW_MS)
    if (bucket.timestamps.length === 0) {
      buckets.delete(key)
    }
  }
}

export function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const limit = getLimit()

  pruneExpiredBuckets(now)

  let bucket = buckets.get(ip)
  if (!bucket) {
    bucket = { timestamps: [] }
    buckets.set(ip, bucket)
  }

  if (bucket.timestamps.length >= limit) {
    return false
  }

  bucket.timestamps.push(now)
  return true
}

/** @internal For unit tests only */
export function bucketCountForTests(): number {
  return buckets.size
}
