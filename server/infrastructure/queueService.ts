/**
 * Infrastructure Layer: Queue Service
 * Handles background processing of TTS jobs using Bull
 */
import Bull from 'bull';
import { supabaseAdmin } from './supabaseClient';
import { InsertTTSJob, TTSJobStatus, TextToSpeechRequest } from '@shared/schema';
import { audioService } from './audioService';
import { storageService } from './storageService';
import { v4 as uuid } from 'uuid';
import * as path from 'path';
import Redis from 'ioredis';

// Define job types
export interface TTSJob {
  id: string;
  request: TextToSpeechRequest;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: {
    audioUrls?: string[];
    error?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Create queue with basic configuration
export const ttsQueue = new Bull<TextToSpeechRequest>('tts-jobs', redisUrl, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000 // 5 seconds
    },
    removeOnComplete: true,
    removeOnFail: false,
    timeout: 30 * 60 * 1000, // 30 minutes
  }
});

// Add queue event handlers for better error tracking
ttsQueue.on('error', (error) => {
  console.error('Queue error:', error);
});

ttsQueue.on('failed', (job, error) => {
  console.error(`Job ${job.id} failed:`, error);
  console.error('Job data:', JSON.stringify(job.data, null, 2));
  console.error('Stack trace:', error.stack);
});

ttsQueue.on('stalled', (job) => {
  console.warn(`Job ${job.id} stalled`);
  console.warn('Job data:', JSON.stringify(job.data, null, 2));
});

ttsQueue.on('waiting', (jobId) => {
  console.log(`Job ${jobId} is waiting`);
});

ttsQueue.on('active', (job) => {
  console.log(`Job ${job.id} has started processing`);
  console.log('Processing chapters:', job.data.chapters?.map(c => c.title).join(', '));
});

// Process jobs
ttsQueue.process(async (job) => {
  const request = job.data;
  const startTime = Date.now();
  
  try {
    // Update job status
    await job.progress(0);
    console.log(`Starting job ${job.id} with ${request.chapters?.length || 0} chapters`);
    
    // Generate audio for each chapter
    const audioUrls = await Promise.all(
      request.chapters?.map(async (chapter: { text: string; title: string }, index: number) => {
        const chapterStartTime = Date.now();
        console.log(`Processing chapter ${index + 1}/${request.chapters?.length}: ${chapter.title}`);
        console.log(`Chapter text length: ${chapter.text.length} characters`);
        
        try {
          const audioUrl = await audioService.convertTextToSpeech({
            text: chapter.text,
            voiceId: request.voiceId,
            title: chapter.title
          });
          
          // Upload to cloud storage
          const key = `audio/${path.basename(audioUrl)}`;
          const localAudioPath = path.join(process.cwd(), audioUrl.substring(1));
          await storageService.uploadFile(localAudioPath, key, 'audio/mpeg');
          
          const chapterEndTime = Date.now();
          console.log(`Chapter ${chapter.title} completed in ${(chapterEndTime - chapterStartTime) / 1000} seconds`);
          
          // Update progress
          const progress = Math.round(((index + 1) / (request.chapters?.length || 1)) * 100);
          await job.progress(progress);
          
          return storageService.getPublicUrl(key);
        } catch (error) {
          console.error(`Error processing chapter ${chapter.title}:`, error);
          throw error;
        }
      }) || []
    );
    
    const endTime = Date.now();
    console.log(`Job ${job.id} completed in ${(endTime - startTime) / 1000} seconds`);
    
    // Update job status
    await job.progress(100);
    
    return {
      status: 'completed',
      result: {
        audioUrls
      }
    };
  } catch (error: any) {
    const endTime = Date.now();
    console.error(`Job ${job.id} failed after ${(endTime - startTime) / 1000} seconds:`, error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      jobId: job.id,
      chapters: request.chapters?.map(c => c.title)
    });
    // Let Bull mark the job as failed so the `failed` event handler runs
    throw error;
  }
});

// Queue event handlers
ttsQueue.on('completed', async (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
  try {
    await queueService.updateJobStatus(job.id.toString(), {
      status: 'completed',
      audioUrls: result.result.audioUrls,
      progress: 100,
      processedChapters: job.data.chapters?.length || 1,
      createdAt: job.timestamp.toString(),
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating job status:', error);
  }
});

ttsQueue.on('failed', async (job, error) => {
  console.error(`Job ${job.id} failed:`, error);
  try {
    const progress = await job.progress();
    await queueService.updateJobStatus(job.id.toString(), {
      status: 'failed',
      error: error.message || 'Unknown error occurred',
      progress,
      processedChapters: job.data.chapters?.length || 1,
      createdAt: job.timestamp.toString(),
      updatedAt: new Date().toISOString()
    });
  } catch (updateError) {
    console.error('Error updating failed job status:', updateError);
  }
});

export class QueueService {
  async addTTSJob(request: TextToSpeechRequest, userId: string): Promise<{ jobId: string }> {
    try {
      // Create job record in Supabase
      const now = new Date().toISOString();
      const { data, error } = await supabaseAdmin
        .from('tts_jobs')
        .insert({
          user_id: userId,
          status: 'pending',
          total_chapters: request.chapters?.length || 1,
          processed_chapters: 0,
          progress: 0,
          created_at: now,
          updated_at: now,
        })
        .select('id')
        .single();
      
      if (error || !data) {
        throw error || new Error('Failed to create job record');
      }
      
      const jobId = data.id.toString();
      
      // Add job to queue with retry handling
      try {
        await ttsQueue.add(request, {
          jobId,
          attempts: 1, // Reduce to 1 attempt
          removeOnComplete: true,
          removeOnFail: false,
          timeout: 15 * 60 * 1000, // 15 minutes
        });
        return { jobId };
      } catch (queueError) {
        // If queue operation fails, clean up the Supabase record
        await supabaseAdmin
          .from('tts_jobs')
          .delete()
          .eq('id', jobId);
        throw queueError;
      }
    } catch (error) {
      console.error('Error adding TTS job:', error);
      throw error;
    }
  }

  async updateJobStatus(jobId: string, status: TTSJobStatus) {
    await supabaseAdmin
      .from('tts_jobs')
      .update({
        status: status.status,
        audio_urls: status.audioUrls,
        error: status.error,
        progress: status.progress,
        processed_chapters: status.processedChapters,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }

  async getJobStatus(jobId: string): Promise<TTSJobStatus | null> {
    const { data, error } = await supabaseAdmin
      .from('tts_jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    if (error || !data) return null;
    return {
      status: data.status,
      audioUrls: data.audio_urls,
      error: data.error,
      progress: data.progress,
      totalChapters: data.total_chapters,
      processedChapters: data.processed_chapters,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async cancelJob(jobId: string): Promise<boolean> {
    try {
      // Get the job from the queue
      const job = await ttsQueue.getJob(jobId);
      if (!job) return false;

      // Remove the job from the queue
      await job.remove();

      // Update job status in Supabase
      await this.updateJobStatus(jobId, {
        status: 'cancelled',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      console.error('Error cancelling job:', error);
      return false;
    }
  }

  async updateJobProgress(jobId: string, progress: number, processedChapters: number): Promise<void> {
    await this.updateJobStatus(jobId, {
      status: 'processing',
      progress,
      processedChapters,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}

export const queueService = new QueueService(); 