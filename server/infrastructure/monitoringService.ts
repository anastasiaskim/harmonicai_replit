import { supabaseAdmin } from './supabaseClient';
import { cacheService } from './cacheService';

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  timestamp: string;
}

export interface AlertThresholds {
  cpuUsage: number;
  memoryUsage: number;
  errorRate: number;
  responseTime: number;
}

export class MonitoringService {
  private readonly metricsTable = 'system_metrics';
  private readonly alertThresholds: AlertThresholds;

  constructor(alertThresholds?: Partial<AlertThresholds>) {
    this.alertThresholds = {
      cpuUsage: 80, // 80%
      memoryUsage: 80, // 80%
      errorRate: 5, // 5%
      responseTime: 1000, // 1 second
      ...alertThresholds
    };
  }

  async recordMetrics(metrics: SystemMetrics): Promise<void> {
    try {
      // Store metrics in database
      const { error } = await supabaseAdmin
        .from(this.metricsTable)
        .insert({
          cpu_usage: metrics.cpuUsage,
          memory_usage: metrics.memoryUsage,
          active_connections: metrics.activeConnections,
          request_count: metrics.requestCount,
          error_count: metrics.errorCount,
          average_response_time: metrics.averageResponseTime,
          timestamp: metrics.timestamp,
        });

      if (error) {
        console.error('Failed to store metrics:', error);
      }

      // Cache latest metrics for quick access
      await cacheService.set('latest_metrics', metrics, 60); // Cache for 1 minute

      // Check for alerts
      await this.checkAlerts(metrics);
    } catch (error) {
      console.error('Error recording metrics:', error);
    }
  }

  private async checkAlerts(metrics: SystemMetrics): Promise<void> {
    const alerts = [];

    if (metrics.cpuUsage > this.alertThresholds.cpuUsage) {
      alerts.push(`High CPU usage: ${metrics.cpuUsage}%`);
    }

    if (metrics.memoryUsage > this.alertThresholds.memoryUsage) {
      alerts.push(`High memory usage: ${metrics.memoryUsage}%`);
    }

    const errorRate = metrics.requestCount > 0
      ? (metrics.errorCount / metrics.requestCount) * 100
      : 0;
    if (errorRate > this.alertThresholds.errorRate) {
      alerts.push(`High error rate: ${errorRate.toFixed(2)}%`);
    }

    if (metrics.averageResponseTime > this.alertThresholds.responseTime) {
      alerts.push(`Slow response time: ${metrics.averageResponseTime}ms`);
    }

    if (alerts.length > 0) {
      await this.sendAlert(alerts.join(', '));
    }
  }

  private async sendAlert(message: string): Promise<void> {
    try {
      // Store alert in database
      const { error } = await supabaseAdmin
        .from('system_alerts')
        .insert({
          message,
          severity: 'high',
          created_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Failed to store alert:', error);
      }

      // TODO: Implement additional alert channels (email, Slack, etc.)
      console.error('System Alert:', message);
    } catch (error) {
      console.error('Error sending alert:', error);
    }
  }

  async getMetrics(
    startDate: string,
    endDate: string,
    limit = 100
  ): Promise<SystemMetrics[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from(this.metricsTable)
        .select('*')
        .gte('timestamp', startDate)
        .lte('timestamp', endDate)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Failed to fetch metrics:', error);
        return [];
      }

      return data.map(metric => ({
        cpuUsage: metric.cpu_usage,
        memoryUsage: metric.memory_usage,
        activeConnections: metric.active_connections,
        requestCount: metric.request_count,
        errorCount: metric.error_count,
        averageResponseTime: metric.average_response_time,
        timestamp: metric.timestamp,
      }));
    } catch (error) {
      console.error('Error fetching metrics:', error);
      return [];
    }
  }

  async getLatestMetrics(): Promise<SystemMetrics | null> {
    return cacheService.get<SystemMetrics>('latest_metrics');
  }
}

export const monitoringService = new MonitoringService(); 