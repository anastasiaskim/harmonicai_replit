import { Request, Response, NextFunction } from 'express';
import { monitoringService } from '../infrastructure/monitoringService';
import { cacheService } from '../infrastructure/cacheService';
import { v4 as uuidv4 } from 'uuid';

export const metricsMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || uuidv4();

  // Track request count
  await cacheService.increment('total_requests');

  // Store request start time
  await cacheService.set(`request:${requestId}:start`, startTime, 300); // 5 minutes TTL

  // Add response listener
  res.on('finish', async () => {
    try {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Track response time
      await cacheService.increment('total_response_time', duration);

      // Track error count if status >= 400
      if (res.statusCode >= 400) {
        await cacheService.increment('error_count');
      }

      // Get current metrics
      const metrics = await monitoringService.getLatestMetrics() || {
        cpuUsage: 0,
        memoryUsage: 0,
        activeConnections: 0,
        requestCount: 0,
        errorCount: 0,
        averageResponseTime: 0,
        timestamp: new Date().toISOString(),
      };

      // Update metrics
      const totalRequests = await cacheService.get<number>('total_requests') || 0;
      const totalResponseTime = await cacheService.get<number>('total_response_time') || 0;
      const errorCount = await cacheService.get<number>('error_count') || 0;

      const updatedMetrics = {
        ...metrics,
        requestCount: totalRequests,
        errorCount,
        averageResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
        timestamp: new Date().toISOString(),
      };

      // Record updated metrics
      await monitoringService.recordMetrics(updatedMetrics);

      // Clean up request data
      await cacheService.delete(`request:${requestId}:start`);
    } catch (error) {
      // Log the error but don't throw it since this is in an event handler
      console.error('Error in metrics middleware finish handler:', {
        error,
        requestId,
        path: req.path,
        method: req.method,
        statusCode: res.statusCode
      });
    }
  });

  next();
}; 