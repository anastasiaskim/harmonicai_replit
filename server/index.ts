import 'dotenv/config';
console.log('ELEVENLABS_API_KEY:', process.env.ELEVENLABS_API_KEY ? '[SET]' : '[NOT SET]');
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import cors from 'cors';
import { corsConfig } from './config/cors.config';

const app = express();
// Apply CORS configuration
app.use(cors(corsConfig));
// Increase JSON payload limit to 10MB to handle large text content
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Sanitize request data for logging
const sanitizeForLogging = (data: any): any => {
  if (data === null || typeof data !== 'object') return data;
  const sensitiveFields = ['password', 'token', 'key', 'secret', 'authorization', 'auth', 'bearer', 'jwt', 'session', 'cookie'];

  if (Array.isArray(data)) {
    return data.map(sanitizeForLogging);
  }

   const sanitized: Record<string, any> = {};
   for (const key in data) {
    const keyLower = key.toLowerCase();
    if (sensitiveFields.some(field => keyLower.includes(field))) {
       sanitized[key] = '[REDACTED]';
     } else if (typeof data[key] === 'object' && data[key] !== null) {
       sanitized[key] = sanitizeForLogging(data[key]);
     } else {
       sanitized[key] = data[key];
     }
   }
   return sanitized;
 };

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    // Log detailed error information
    console.error('Error details:', {
      status,
      message,
      stack: err.stack,
      path: _req.path,
      method: _req.method,
      body: sanitizeForLogging(_req.body),
      query: sanitizeForLogging(_req.query),
      params: _req.params
    });

    res.status(status).json({
      error: message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    // await setupVite(app, server); // Disabled for troubleshooting
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 3000
  // this serves both the API and the client.
  const port = 3000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
