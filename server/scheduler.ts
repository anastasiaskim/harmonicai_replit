/**
 * Scheduler
 * Handles periodic tasks like cleanup jobs
 */
import cron from 'node-cron';
import { cleanupService } from './infrastructure/cleanupService';

export function startScheduler() {
  // Run cleanup jobs every day at 2 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('Starting scheduled cleanup jobs...');
    
    try {
      // Clean up old files
      await cleanupService.cleanupOldFiles();
      
      // Clean up unused files
      await cleanupService.cleanupUnusedFiles();
      
      console.log('Scheduled cleanup jobs completed successfully');
    } catch (error) {
      console.error('Error running scheduled cleanup jobs:', error);
    }
  });
  
  console.log('Scheduler started');
} 