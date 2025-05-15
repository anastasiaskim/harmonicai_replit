/**
 * Application Layer: Use Cases
 * Orchestrates the application logic by coordinating domain and infrastructure components
 */
import { storage } from '../storage';
import { fileService } from '../infrastructure/fileService';
import { chapterService } from '../infrastructure/chapterService';
import { audioService } from '../infrastructure/audioService';
import { TextToSpeechRequest, Voice } from '@shared/schema';

// Interface for file upload input
export interface ProcessTextInput {
  file?: Express.Multer.File;
  directText?: string;
}

// Interface for text processing output
export interface ProcessTextOutput {
  text: string;
  chapters: { title: string; text: string }[];
  charCount: number;
}

/**
 * Use Case: Get Voices
 * Retrieves available voice options
 */
export async function getVoicesUseCase(): Promise<Voice[]> {
  return storage.getVoices();
}

/**
 * Use Case: Process Text
 * Handles text processing from file uploads or direct text input
 */
export async function processTextUseCase(input: ProcessTextInput): Promise<ProcessTextOutput> {
  let text = '';
  let fileType = 'direct';

  // Process file or use direct text
  if (input.file) {
    const result = fileService.processFile(input.file);
    text = result.text;
    fileType = result.fileType;
  } else if (input.directText) {
    text = input.directText;
  } else {
    throw new Error('No file or text provided');
  }

  // Enforce character limit
  if (text.length > 50000) {
    text = text.substring(0, 50000);
  }

  // Update analytics
  await fileService.updateFileAnalytics(fileType, text.length);

  // Detect chapters in the text
  const chapters = chapterService.detectChapters(text);

  return {
    text,
    chapters,
    charCount: text.length,
  };
}

/**
 * Use Case: Generate Audiobook
 * Coordinates the process of converting text to speech and storing the results
 */
export async function generateAudiobookUseCase(request: TextToSpeechRequest) {
  const { voice, chapters } = request;

  // Validate request
  if (!voice) {
    throw new Error('Voice selection is required');
  }

  if (chapters.length === 0) {
    throw new Error('No chapters provided');
  }

  // Verify the voice exists
  const voiceData = await storage.getVoiceByVoiceId(voice);
  if (!voiceData) {
    throw new Error('Invalid voice selection');
  }

  // Process each chapter
  const processedChapters = [];
  for (const chapter of chapters) {
    try {
      // Generate audio for this chapter
      const chapterData = await audioService.generateAudio(chapter, voice);
      
      // Store chapter in database
      const insertedChapter = await storage.insertChapter(chapterData);
      
      processedChapters.push({
        id: insertedChapter.id,
        title: insertedChapter.title,
        audioUrl: insertedChapter.audioUrl,
        duration: insertedChapter.duration,
        size: insertedChapter.size
      });
    } catch (error) {
      console.error(`Error processing chapter "${chapter.title}":`, error);
    }
  }

  // Update voice usage analytics
  await audioService.updateVoiceAnalytics(voice);

  return processedChapters;
}

/**
 * Use Case: Get Analytics
 * Retrieves usage analytics
 */
export async function getAnalyticsUseCase() {
  return storage.getAnalytics();
}