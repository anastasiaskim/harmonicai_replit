/**
 * Infrastructure Layer: Cleanup Service
 * Handles cleanup of old and unused audio files
 */
import { storageService } from './storageService';
import { supabaseAdmin } from './supabaseClient';
import { cacheService } from './cacheService';

export class CleanupService {
  private readonly retentionPeriod = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  private readonly batchSize = 100;

  /**
   * Clean up old audio files
   */
  async cleanupOldFiles(): Promise<void> {
    try {
      // Get all files from storage
      const files = await storageService.listFiles('');
      
      // Process files in chunks to limit concurrency
      const fileMetadata = [];
      for (let i = 0; i < files.length; i += this.batchSize) {
        const chunk = files.slice(i, i + this.batchSize);
        const chunkMetadata = await Promise.all(
          chunk.map(async (file) => {
            const metadata = await storageService.getFileMetadata(file);
            return {
              key: file,
              lastModified: metadata?.LastModified,
              size: metadata?.ContentLength || 0
            };
          })
        );
        fileMetadata.push(...chunkMetadata);
      }

      // Filter old files
      const now = new Date();
      const oldFiles = fileMetadata.filter(
        (file) => file.lastModified && (now.getTime() - file.lastModified.getTime() > this.retentionPeriod)
      );

      // Delete files in batches
      for (let i = 0; i < oldFiles.length; i += this.batchSize) {
        const batch = oldFiles.slice(i, i + this.batchSize);
        await Promise.all(
          batch.map(async (file) => {
            try {
              await storageService.deleteFile(file.key);
              console.log(`Deleted old file: ${file.key}`);
            } catch (error) {
              console.error(`Failed to delete file ${file.key}:`, error);
            }
          })
        );
      }

      // Update cleanup metrics
      await this.updateCleanupMetrics(oldFiles.length);
    } catch (error) {
      console.error('Error in cleanup process:', error);
    }
  }

  private async updateCleanupMetrics(deletedCount: number): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('cleanup_metrics')
        .insert({
          deleted_files: deletedCount,
          timestamp: new Date().toISOString()
        });

      if (error) {
        console.error('Failed to update cleanup metrics:', error);
      }

      // Cache latest cleanup stats
      await cacheService.set('latest_cleanup', {
        deletedCount,
        lastCleanup: new Date().toISOString()
      }, 3600); // Cache for 1 hour
    } catch (error) {
      console.error('Error updating cleanup metrics:', error);
    }
  }

  async getCleanupStats(): Promise<{
    lastCleanup: string;
    deletedCount: number;
  } | null> {
    return cacheService.get('latest_cleanup');
  }

  /**
   * Clean up unused audio files (not referenced in the database)
   */
  async cleanupUnusedFiles(): Promise<void> {
    try {
      // Get all audio files from storage
      const files = await storageService.listFiles('audio/');
      
      // Get all chapters from database
      const { data: chapters, error } = await supabaseAdmin
        .from('chapters')
        .select('audio_url');
      if (error) throw error;
      
      // Get audio URLs from chapters
      const usedAudioUrls = new Set(
        (chapters || []).map((chapter: { audio_url: string }) => chapter.audio_url)
      );
      
      // Find unused files
      const unusedFiles = files.filter(file => {
        const fileUrl = storageService.getPublicUrl(file);
        return !usedAudioUrls.has(fileUrl);
      });
      
      // Delete unused files in batches
      for (let i = 0; i < unusedFiles.length; i += this.batchSize) {
        const batch = unusedFiles.slice(i, i + this.batchSize);
        await Promise.all(
          batch.map(file => storageService.deleteFile(file))
        );
      }
      
      console.log(`Cleaned up ${unusedFiles.length} unused audio files`);
    } catch (error) {
      console.error('Error cleaning up unused files:', error);
    }
  }
}

export const cleanupService = new CleanupService(); 