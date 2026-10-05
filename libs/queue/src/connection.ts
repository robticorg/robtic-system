import type { ConnectionOptions } from "bullmq";

/**
 * Redis connection options from `REDIS_URL` (e.g. `redis://redis:6379`, `rediss://user:pass@host:6380/1`).
 * Never hardcoded: inside Docker the service name is the host, and `localhost` would be this
 * container. `maxRetriesPerRequest: null` is what BullMQ workers require.
 */
export function redisConnection(url = process.env.REDIS_URL): ConnectionOptions {
    if (!url) throw new Error("REDIS_URL is not set — queues need Redis (redis://redis:6379 in Docker Compose)");

    const parsed = new URL(url);
    if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
        throw new Error(`REDIS_URL must start with redis:// or rediss:// (got ${parsed.protocol})`);
    }

    return {
        host: parsed.hostname,
        port: Number(parsed.port) || 6379,
        username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
        password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
        db: parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) || 0 : 0,
        ...(parsed.protocol === "rediss:" ? { tls: {} } : {}),
        maxRetriesPerRequest: null,
    };
}

export function isRedisConfigured(): boolean {
    return Boolean(process.env.REDIS_URL);
}
