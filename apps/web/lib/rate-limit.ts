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

export function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const limit = getLimit()
  let bucket = buckets.get(ip)

  if (!bucket) {
    bucket = { timestamps: [] }
    buckets.set(ip, bucket)
  }

  bucket.timestamps = bucket.timestamps.filter((t) => now - t < WINDOW_MS)

  if (bucket.timestamps.length >= limit) {
    return false
  }

  bucket.timestamps.push(now)
  return true
}
