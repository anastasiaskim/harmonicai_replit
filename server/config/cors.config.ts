import { CorsOptions } from 'cors';

const isDevelopment = process.env.NODE_ENV === 'development';

// Default allowed origins for production
const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174'
];

// Get allowed origins from environment variable or use defaults
const getAllowedOrigins = (): string[] => {
  if (isDevelopment) {
    return ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174']; // Explicit development origins
  }
  
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (envOrigins) {
    return envOrigins.split(',')
      .map(origin => origin.trim())
      .filter(origin => origin !== '')
      .filter(origin => {
        try {
          new URL(origin);
          return true;
        } catch (e) {
          console.warn(`Invalid origin URL: ${origin}`);
          return false;
        }
      });
  }
  
  return defaultAllowedOrigins;
};

export const corsConfig: CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    
    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if wildcard is allowed
    if (allowedOrigins.includes('*')) {
      if (isDevelopment) {
        return callback(null, true);
      } else {
        console.warn('Warning: Wildcard CORS origin is enabled in a non-development environment. This poses a security risk.');
        return callback(new Error('Wildcard CORS origin is not allowed in production'));
      }
    }
    
    // Check if the origin is in the allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}; 