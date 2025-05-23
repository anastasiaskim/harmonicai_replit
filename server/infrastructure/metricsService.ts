import { ttsQueue } from './queueService';
import { supabaseAdmin } from './supabaseClient';

export interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  timestamp: string;
}

export interface WorkerMetrics {
  activeWorkers: number;
  processedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  timestamp: string;
}

export class MetricsService {
  private static instance: MetricsService;
  private metricsInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  async startMetricsCollection(intervalMs = 60000): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Collect metrics immediately
    await this.collectMetrics();

    // Then collect at regular intervals
    this.metricsInterval = setInterval(async () => {
      await this.collectMetrics();
    }, intervalMs);
  }

  async stopMetricsCollection(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  async collectMetrics(): Promise<void> {
    try {
      const queueMetrics = await this.getQueueMetrics();
      const workerMetrics = await this.getWorkerMetrics();
      const now = new Date().toISOString();

      await supabaseAdmin.from('metrics').insert({
        queue_metrics: queueMetrics,
        worker_metrics: workerMetrics,
        created_at: now,
        updated_at: now
      });
    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
  }

  async getLatestMetrics(): Promise<{
    queue_metrics: QueueMetrics;
    worker_metrics: WorkerMetrics;
    created_at: string;
    updated_at: string;
  } | null> {
    try {
      const { data: metrics } = await supabaseAdmin
        .from('metrics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return metrics;
    } catch (error) {
      console.error('Error getting latest metrics:', error);
      return null;
    }
  }

  async trackJobProcessingTime(processingTime: number): Promise<void> {
    try {
      const { data: metrics } = await supabaseAdmin
        .from('metrics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (metrics) {
        const workerMetrics = metrics.workerMetrics || {};
        const totalJobs = (workerMetrics.processedJobs || 0) + 1;
        const totalTime = (workerMetrics.averageProcessingTime || 0) * (totalJobs - 1) + processingTime;
        const avgTime = totalTime / totalJobs;
        const now = new Date().toISOString();

        await supabaseAdmin
          .from('metrics')
          .update({
            workerMetrics: {
              ...workerMetrics,
              processedJobs: totalJobs,
              averageProcessingTime: avgTime
            },
            updated_at: now
          })
          .eq('id', metrics.id);
      }
    } catch (error) {
      console.error('Error tracking job processing time:', error);
    }
  }

  private async getQueueMetrics(): Promise<QueueMetrics> {
    const queue = ttsQueue;
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.getPausedCount()
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
      timestamp: new Date().toISOString()
    };
  }

  private async getWorkerMetrics(): Promise<WorkerMetrics> {
    const queue = ttsQueue;
    const workers = await queue.getWorkers();
    const activeWorkers = workers.length;
    const processedJobs = await queue.getCompletedCount();
    const failedJobs = await queue.getFailedCount();

    // Get recent completed jobs to calculate average processing time
    const recentJobs = await queue.getCompleted(0, 100); // Get last 100 completed jobs
    const processingTimes = recentJobs
      .map(job => {
        const startTime = job.processedOn ? new Date(job.processedOn).getTime() : 0;
        const finishTime = job.finishedOn ? new Date(job.finishedOn).getTime() : 0;
        return finishTime - startTime;
      })
      .filter(time => time > 0); // Filter out invalid times

    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0;

    return {
      activeWorkers,
      processedJobs,
      failedJobs,
      averageProcessingTime,
      timestamp: new Date().toISOString()
    };
  }
}

export const metricsService = MetricsService.getInstance(); 