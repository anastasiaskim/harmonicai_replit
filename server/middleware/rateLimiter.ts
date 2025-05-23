import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import { RateLimiterRedis } from 'rate-limiter-flexible';

// Validate Redis URL
const validateRedisUrl = (url: string | undefined): string => {
  if (!url) {
    throw new Error('REDIS_URL environment variable is not defined');
  }

  try {
    const redisUrl = new URL(url);
    if (redisUrl.protocol !== 'redis:') {
      throw new Error('REDIS_URL must use the redis:// protocol');
    }
    return url;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('REDIS_URL is not a valid URL');
    }
    throw error;
  }
};

// Initialize Redis client with validation
let redisClient: Redis;
try {
  const redisUrl = validateRedisUrl(process.env.REDIS_URL);
  redisClient = new Redis(redisUrl, {
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    connectTimeout: 10000,
  });

  // Add error handling for Redis client
  redisClient.on('error', (error) => {
    console.error('Redis client error:', error);
  });

  redisClient.on('connect', () => {
    console.log('Redis client connected successfully');
  });
} catch (error) {
  console.error('Failed to initialize Redis client:', error);
  throw error; // Re-throw to prevent the application from starting with invalid Redis configuration
}

// Create rate limiter
const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rate_limit',
  points: 100, // Number of requests
  duration: 60, // Per minute
  blockDuration: 60 * 2, // Block for 2 minutes if limit is exceeded
});

// Type guard for rate limiter error
interface RateLimiterError {
  msBeforeNext: number;
  remainingPoints: number;
  consumedPoints: number;
}

function isRateLimiterError(error: unknown): error is RateLimiterError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'msBeforeNext' in error &&
    typeof (error as RateLimiterError).msBeforeNext === 'number'
  );
}

// Extract client IP address considering proxy headers
const getClientIp = (req: Request): string => {
  // Check for X-Forwarded-For header
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    const ips = typeof forwardedFor === 'string' 
      ? forwardedFor.split(',') 
      : forwardedFor;
    const clientIp = ips[0].trim();
    if (clientIp) return clientIp;
  }

  // Check for X-Real-IP header
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return typeof realIp === 'string' ? realIp : realIp[0];
  }

  // Check for CF-Connecting-IP (Cloudflare)
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) {
    return typeof cfIp === 'string' ? cfIp : cfIp[0];
  }

  // Check for True-Client-IP (Akamai and Cloudflare)
  const trueClientIp = req.headers['true-client-ip'];
  if (trueClientIp) {
    return typeof trueClientIp === 'string' ? trueClientIp : trueClientIp[0];
  }

  // Fall back to req.ip or req.connection.remoteAddress
  return req.ip || req.connection.remoteAddress || 'unknown';
};

export const rateLimiterMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get client IP using the enhanced extraction logic
    const clientIp = getClientIp(req);
    
    // Use a combination of IP and user agent for better identification
    const userAgent = req.headers['user-agent'] || 'unknown';
    const key = `${clientIp}:${userAgent}`;
    
    await rateLimiter.consume(key);
    next();
  } catch (error) {
    if (isRateLimiterError(error)) {
      res.status(429).json({
        error: 'Too many requests',
        message: 'Please try again later',
        retryAfter: Math.ceil(error.msBeforeNext / 1000),
        remainingPoints: error.remainingPoints,
        consumedPoints: error.consumedPoints,
      });
    } else {
      console.error('Unexpected rate limiter error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while processing your request',
      });
    }
  }
}; 