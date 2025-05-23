import { ttsQueue } from '../infrastructure/queueService';
import { audioService } from '../infrastructure/audioService';
import { queueService } from '../infrastructure/queueService';
import { TextToSpeechRequest } from '@shared/schema';
import { Job } from 'bull';
import { textToSpeechService } from '../infrastructure/textToSpeechService';
import { metricsService } from '../infrastructure/metricsService';

console.log('TTS Worker started. Waiting for jobs...');

ttsQueue.process(async (job) => {
  const { data: request } = job;
  const jobId = job.opts.jobId as string;
  const startTime = Date.now();
  try {
    // Update job status to processing
    await queueService.updateJobStatus(jobId, {
      status: 'processing',
      progress: 0,
      processedChapters: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Generate audio for each chapter
    const audioUrls: string[] = [];
    const totalChapters = request.chapters?.length || 1;
    
    if (request.chapters && request.chapters.length > 0) {
      // Process each chapter
      for (let i = 0; i < request.chapters.length; i++) {
        const chapter = request.chapters[i];
        const audioUrl = await audioService.convertTextToSpeech({
          text: chapter.text,
          voiceId: request.voiceId,
          title: chapter.title,
        });
        audioUrls.push(audioUrl);
        
        // Update progress
        const progress = Math.round(((i + 1) / totalChapters) * 100);
        await queueService.updateJobStatus(jobId, {
          status: 'processing',
          progress,
          processedChapters: i + 1,
          audioUrls,
          updatedAt: new Date().toISOString()
        });
      }
    } else {
      // Single chapter/text
      const audioUrl = await audioService.convertTextToSpeech(request);
      audioUrls.push(audioUrl);
      await queueService.updateJobStatus(jobId, {
        status: 'processing',
        progress: 100,
        processedChapters: 1,
        audioUrls,
        updatedAt: new Date().toISOString()
      });
    }

    // Update job status to completed
    await queueService.updateJobStatus(jobId, {
      status: 'completed',
      audioUrls,
      progress: 100,
      processedChapters: totalChapters,
      updatedAt: new Date().toISOString()
    });

    // Track processing time
    const processingTime = Date.now() - startTime;
    await metricsService.trackJobProcessingTime(processingTime);

    return { status: 'completed', audioUrls };
  } catch (error: any) {
    // Update job status to failed
    await queueService.updateJobStatus(jobId, {
      status: 'failed',
      error: error.message || 'Unknown error',
      updatedAt: new Date().toISOString()
    });
    throw error;
  }
});

export async function processTTSJob(job: Job) {
  const { text, voiceId, title, chapters } = job.data;
  const startTime = Date.now();

  try {
    // Update job status to processing
    await queueService.updateJobStatus(job.id.toString(), {
      status: 'processing',
      progress: 0,
      processedChapters: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Process single text or multiple chapters
    const audioUrls: string[] = [];
    const totalChapters = chapters?.length || 1;

    if (chapters && chapters.length > 0) {
      // Process multiple chapters
      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        const audioUrl = await textToSpeechService.generateAudio(chapter.text, voiceId);
        audioUrls.push(audioUrl);

        // Update progress
        const progress = Math.round(((i + 1) / totalChapters) * 100);
        await queueService.updateJobStatus(job.id.toString(), {
          status: 'processing',
          progress,
          processedChapters: i + 1,
          audioUrls,
          updatedAt: new Date().toISOString()
        });
      }
    } else {
      // Process single text
      const audioUrl = await textToSpeechService.generateAudio(text, voiceId);
      audioUrls.push(audioUrl);

      // Update progress
      await queueService.updateJobStatus(job.id.toString(), {
        status: 'processing',
        progress: 100,
        processedChapters: 1,
        audioUrls,
        updatedAt: new Date().toISOString()
      });
    }

    // Update job status to completed
    await queueService.updateJobStatus(job.id.toString(), {
      status: 'completed',
      audioUrls,
      progress: 100,
      processedChapters: totalChapters,
      updatedAt: new Date().toISOString()
    });

    // Track processing time
    const processingTime = Date.now() - startTime;
    await metricsService.trackJobProcessingTime(processingTime);

    return audioUrls;
  } catch (error) {
    console.error('Error processing TTS job:', error);
    await queueService.updateJobStatus(job.id.toString(), {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      updatedAt: new Date().toISOString()
    });
    throw error;
  }
} 