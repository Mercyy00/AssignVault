import crypto from "crypto";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory rate limiting store (swappable to DB/Redis in Step 10)
const rateLimitMap = new Map<string, RateLimitRecord>();

/**
 * Anonymize client IP address using SHA-256 with server salt.
 * Raw IP addresses are NEVER stored in the database.
 */
export function hashIp(ip: string): string {
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY || "assignvault-rate-limit-salt";
  return crypto.createHash("sha256").update(`${ip}:${salt}`).digest("hex");
}

/**
 * Rate limit check: at most maxRequests per windowMs (default: 5 uploads per hour).
 * In development mode, defaults to 20 or env-configured limit to prevent blocking local development.
 */
export function checkRateLimit(
  ipHash: string,
  maxRequests: number = process.env.NODE_ENV === "development" ? 20 : 5,
  windowMs: number = 60 * 60 * 1000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ipHash);

  if (!record || now > record.resetAt) {
    const newRecord: RateLimitRecord = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitMap.set(ipHash, newRecord);
    return { allowed: true, remaining: maxRequests - 1, resetAt: newRecord.resetAt };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count += 1;
  return { allowed: true, remaining: maxRequests - record.count, resetAt: record.resetAt };
}

/**
 * Helper to clear rate limit store for tests.
 */
export function resetRateLimits() {
  rateLimitMap.clear();
}
