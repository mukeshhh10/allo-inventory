/**
 * Redis client for distributed locking and idempotency.
 * Uses ioredis when REDIS_URL is set, otherwise provides an in-memory
 * fallback that works for single-instance dev/demo but is NOT safe for
 * multi-instance production deployments.
 */

type LockResult = { acquired: boolean; release: () => Promise<void> };

// ---------- In-memory fallback (dev / single-instance) ----------
const memoryLocks = new Map<string, { expiry: number }>();
const memoryKv = new Map<string, { value: string; expiry: number }>();

function memNow() {
  return Date.now();
}

function gcMemory() {
  const now = memNow();
  for (const [k, v] of memoryLocks) {
    if (v.expiry < now) memoryLocks.delete(k);
  }
  for (const [k, v] of memoryKv) {
    if (v.expiry < now) memoryKv.delete(k);
  }
}

async function memAcquireLock(key: string, ttlMs: number): Promise<LockResult> {
  gcMemory();
  if (memoryLocks.has(key)) return { acquired: false, release: async () => {} };
  memoryLocks.set(key, { expiry: memNow() + ttlMs });
  return {
    acquired: true,
    release: async () => {
      memoryLocks.delete(key);
    },
  };
}

async function memSet(
  key: string,
  value: string,
  ttlMs: number
): Promise<void> {
  memoryKv.set(key, { value, expiry: memNow() + ttlMs });
}

async function memGet(key: string): Promise<string | null> {
  gcMemory();
  const entry = memoryKv.get(key);
  return entry ? entry.value : null;
}

// ---------- Redis-backed implementation ----------
let redisClient: import("ioredis").Redis | null = null;

async function getRedis() {
  if (!process.env.REDIS_URL) return null;
  if (redisClient) return redisClient;
  const { default: Redis } = await import("ioredis");
  redisClient = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
  await redisClient.connect().catch(() => {
    // if connection fails, fall back to memory
    redisClient = null;
  });
  return redisClient;
}

// ---------- Public API ----------

/**
 * Acquire a distributed lock. Returns { acquired, release }.
 * TTL is in milliseconds; default 30 s.
 */
export async function acquireLock(
  key: string,
  ttlMs = 30_000
): Promise<LockResult> {
  const redis = await getRedis();
  const lockKey = `lock:${key}`;
  const token = crypto.randomUUID();

  if (!redis) return memAcquireLock(lockKey, ttlMs);

  // SET NX PX is atomic — exactly one caller wins.
  const result = await redis.set(lockKey, token, "PX", ttlMs, "NX");
  if (result !== "OK") return { acquired: false, release: async () => {} };

  return {
    acquired: true,
    release: async () => {
      // Only delete if we still own the lock (Lua is atomic).
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      await redis.eval(script, 1, lockKey, token);
    },
  };
}

/**
 * Set a key with a TTL in milliseconds.
 */
export async function cacheSet(
  key: string,
  value: string,
  ttlMs: number
): Promise<void> {
  const redis = await getRedis();
  if (!redis) return memSet(key, value, ttlMs);
  await redis.set(key, value, "PX", ttlMs);
}

/**
 * Get a cached value.
 */
export async function cacheGet(key: string): Promise<string | null> {
  const redis = await getRedis();
  if (!redis) return memGet(key);
  return redis.get(key);
}
