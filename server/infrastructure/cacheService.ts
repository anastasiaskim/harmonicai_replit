import Redis from 'ioredis';

export class CacheService {
  private redis: Redis;
  private defaultTTL = 3600; // 1 hour in seconds
  private isConnected: boolean = false;
  private connectionPromise: Promise<void> | null = null;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, {
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 10000,
    });

    // Set up event listeners
    this.redis.on('connect', () => {
      console.log('Redis client connected');
      this.isConnected = true;
    });

    this.redis.on('error', (error) => {
      console.error('Redis client error:', error);
      this.isConnected = false;
    });

    this.redis.on('close', () => {
      console.log('Redis client connection closed');
      this.isConnected = false;
    });

    // Initialize connection health check
    this.connectionPromise = this.initializeConnection();
  }

  private async initializeConnection(): Promise<void> {
    try {
      // Ping Redis to verify connection
      await this.redis.ping();
      this.isConnected = true;
      console.log('Redis connection health check passed');
    } catch (error) {
      this.isConnected = false;
      console.error('Redis connection health check failed:', error);
      throw new Error('Failed to connect to Redis');
    }
  }

  private async ensureConnection(): Promise<void> {
    if (!this.isConnected) {
      if (!this.connectionPromise) {
        this.connectionPromise = this.initializeConnection();
      }
      await this.connectionPromise;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      await this.ensureConnection();
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = this.defaultTTL): Promise<void> {
    try {
      await this.ensureConnection();
      const serializedValue = JSON.stringify(value);
      await this.redis.set(key, serializedValue, 'EX', ttl);
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.ensureConnection();
      await this.redis.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.ensureConnection();
      await this.redis.flushall();
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = this.defaultTTL
  ): Promise<T> {
    try {
      await this.ensureConnection();
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      const fresh = await fetchFn();
      await this.set(key, fresh, ttl);
      return fresh;
    } catch (error) {
      console.error('Cache getOrSet error:', error);
      // If cache operations fail, fall back to fetching fresh data
      return await fetchFn();
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      await this.ensureConnection();
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache pattern delete error:', error);
    }
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      await this.ensureConnection();
      return await this.redis.incrby(key, amount);
    } catch (error) {
      console.error('Cache increment error:', error);
      return 0;
    }
  }

  async mset(entries: Record<string, any>, ttl: number = this.defaultTTL): Promise<void> {
    try {
      await this.ensureConnection();
      const pipeline = this.redis.pipeline();
      for (const [key, value] of Object.entries(entries)) {
        const serializedValue = JSON.stringify(value);
        pipeline.set(key, serializedValue, 'EX', ttl);
      }
      await pipeline.exec();
    } catch (error) {
      console.error('Cache mset error:', error);
    }
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      await this.ensureConnection();
      const values = await this.redis.mget(keys);
      return values.map(value => value ? JSON.parse(value) : null);
    } catch (error) {
      console.error('Cache mget error:', error);
      return keys.map(() => null);
    }
  }

  // Add method to check connection status
  isRedisConnected(): boolean {
    return this.isConnected;
  }

  // Add method to manually reconnect
  async reconnect(): Promise<void> {
    try {
      await this.redis.quit();
      this.connectionPromise = null;
      this.isConnected = false;
      await this.initializeConnection();
    } catch (error) {
      console.error('Redis reconnection error:', error);
      throw error;
    }
  }
}

export const cacheService = new CacheService(); 