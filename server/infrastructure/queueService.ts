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
export const ttsQueue = new Bull<TextToSpeechRequest>('tts-jobs', redisUrl);

// Process jobs
ttsQueue.process(async (job) => {
  const { request } = job.data;
  
  try {
    // Update job status
    await job.progress(0);
    
    // Generate audio for each chapter
    const audioUrls = await Promise.all(
      request.chapters.map(async (chapter: { text: string; title: string }) => {
        const audioUrl = await audioService.convertTextToSpeech({
          text: chapter.text,
          voiceId: request.voiceId,
          title: chapter.title
        });
        
        // Upload to cloud storage
        const key = `audio/${path.basename(audioUrl)}`;
        await storageService.uploadFile(audioUrl, key, 'audio/mpeg');
        
        return storageService.getPublicUrl(key);
      })
    );
    
    // Update job status
    await job.progress(100);
    
    return {
      status: 'completed',
      result: {
        audioUrls
      }
    };
  } catch (error: any) {
    console.error('Error processing TTS job:', error);
    return {
      status: 'failed',
      result: {
        error: error.message || 'Unknown error occurred'
      }
    };
  }
});

// Queue event handlers
ttsQueue.on('completed', async (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
  await queueService.updateJobStatus(job.id.toString(), {
    status: 'completed',
    audioUrls: result.result.audioUrls,
    progress: 100,
    processedChapters: job.data.request.chapters?.length || 1,
    createdAt: job.timestamp.toString(),
    updatedAt: new Date().toISOString()
  });
});

ttsQueue.on('failed', async (job, error) => {
  console.error(`Job ${job.id} failed:`, error);
  await queueService.updateJobStatus(job.id.toString(), {
    status: 'failed',
    error: error.message || 'Unknown error occurred',
    progress: job.progress(),
    processedChapters: job.data.request.chapters?.length || 1,
    createdAt: job.timestamp.toString(),
    updatedAt: new Date().toISOString()
  });
});

export class QueueService {
  async addTTSJob(request: TextToSpeechRequest, userId: string): Promise<{ jobId: string }> {
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
    if (error || !data) throw error || new Error('Failed to create job record');
    const jobId = data.id.toString();
    
    // Add job to queue
    await ttsQueue.add(request, {
      jobId,
      attempts: 3,
      removeOnComplete: true,
      removeOnFail: false,
      timeout: 5 * 60 * 1000, // 5 minutes
    });
    return { jobId };
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