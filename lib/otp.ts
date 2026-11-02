// Global cache for OTPs to avoid database schema changes
const globalForOTP = global as unknown as { otpCache: Map<string, { otp: string; expires: number }> };
if (!globalForOTP.otpCache) {
  globalForOTP.otpCache = new Map();
}

export function setCachedOTP(email: string, otp: string, ttlMs: number = 10 * 60 * 1000) {
  globalForOTP.otpCache.set(email.toLowerCase(), {
    otp,
    expires: Date.now() + ttlMs,
  });
}

export function getCachedOTP(email: string): string | null {
  const data = globalForOTP.otpCache.get(email.toLowerCase());
  if (!data) return null;
  if (Date.now() > data.expires) {
    globalForOTP.otpCache.delete(email.toLowerCase());
    return null;
  }
  return data.otp;
}

export function clearCachedOTP(email: string) {
  globalForOTP.otpCache.delete(email.toLowerCase());
}
