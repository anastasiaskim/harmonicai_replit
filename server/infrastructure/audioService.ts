/**
 * Infrastructure Layer: Audio Service
 * Handles audio generation and audio file management
 */
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { storage } from '../storage';
import { ChapterDTO } from './chapterService';
import { InsertChapter } from '@shared/schema';
import { audioConfig } from '../../config/audio.config';

// Helper function to ensure a directory exists
function ensureDirectoryExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

// Ensure uploads directory exists
const uploadDir = path.resolve(process.cwd(), 'uploads');
ensureDirectoryExists(uploadDir);

// Physical directory for audio files
const audioDir = path.resolve(process.cwd(), audioConfig.outputDirectory);
// Derive public URL prefix from the same config (fallback to '/audio')
const publicAudioPrefix = audioConfig.publicPath ?? `/${audioConfig.outputDirectory}`;

export interface ElevenLabsConfig {
  apiKey: string;
  apiUrl: string;
  voiceMapping: Record<string, string>;
}

export interface AudioResult {
  id: number;
  title: string;
  audioUrl: string;
  duration: number;
  size: number;
}

export interface AudioFileInfo {
  filePath: string;
  exists: boolean;
}

export interface TextToSpeechRequest {
  text: string;
  voiceId: string;
  title: string;
}

class AudioService {
  private elevenLabsConfig: ElevenLabsConfig = {
    apiKey: process.env.ELEVENLABS_API_KEY || '',
    apiUrl: audioConfig.apiUrl,
    voiceMapping: audioConfig.voiceMapping
  };
  
  /**
   * Validate text-to-speech request parameters
   * @param request The text to speech request to validate
   * @throws Error if validation fails
   */
  private validateTextToSpeechRequest(request: TextToSpeechRequest): void {
    if (!request.text || request.text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }
    const validVoiceIds = Object.values(this.elevenLabsConfig.voiceMapping);
    if (
      !request.voiceId ||
      (!this.elevenLabsConfig.voiceMapping[request.voiceId] && !validVoiceIds.includes(request.voiceId))
    ) {
      throw new Error('Invalid voice ID');
    }
    // No need to check for max length here; chunking will handle it
  }

  /**
   * Split text into smaller chunks to stay within API limits (Hybrid: paragraph, then sentence, then word, then character)
   * @param text The text to split
   * @param maxChunkSize Maximum characters per chunk
   * @returns Array of text chunks
   */
  private splitTextIntoChunks(text: string, maxChunkSize: number = audioConfig.maxChunkSize): string[] {
    if (text.length <= maxChunkSize) {
      return [text];
    }
    const chunks: string[] = [];
    // Split by paragraphs first
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';
    for (const para of paragraphs) {
      if (para.length > maxChunkSize) {
        // Paragraph too long, split by sentences
        const sentences = para.split(audioConfig.sentenceSplitRegex);
        for (const sentence of sentences) {
          if (sentence.length > maxChunkSize) {
            // Sentence too long, split by words
            const words = sentence.split(/\s+/);
            let wordChunk = '';
            for (const word of words) {
              if (word.length > maxChunkSize) {
                // Word too long, split by characters
                console.warn('Word exceeds maxChunkSize, splitting by characters:', word.slice(0, 30) + '...');
                for (let i = 0; i < word.length; i += maxChunkSize) {
                  chunks.push(word.slice(i, i + maxChunkSize));
                }
                wordChunk = '';
              } else if ((wordChunk + ' ' + word).trim().length > maxChunkSize) {
                if (wordChunk) chunks.push(wordChunk.trim());
                wordChunk = word;
              } else {
                wordChunk += (wordChunk ? ' ' : '') + word;
              }
            }
            if (wordChunk) chunks.push(wordChunk.trim());
          } else {
            if ((currentChunk + ' ' + sentence).trim().length > maxChunkSize) {
              if (currentChunk) chunks.push(currentChunk.trim());
              currentChunk = sentence;
            } else {
              currentChunk += (currentChunk ? ' ' : '') + sentence;
            }
          }
        }
      } else {
        if ((currentChunk + '\n\n' + para).trim().length > maxChunkSize) {
          if (currentChunk) chunks.push(currentChunk.trim());
          currentChunk = para;
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + para;
        }
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    // Final safety: split any overlong chunk at the character level
    const safeChunks: string[] = [];
    for (const chunk of chunks) {
      if (chunk.length > maxChunkSize) {
        console.warn('Chunk still exceeds maxChunkSize after all splits, splitting by characters:', chunk.slice(0, 30) + '...');
        for (let i = 0; i < chunk.length; i += maxChunkSize) {
          safeChunks.push(chunk.slice(i, i + maxChunkSize));
        }
      } else {
        safeChunks.push(chunk);
      }
    }
    return safeChunks;
  }

  /**
   * Convert text to speech using ElevenLabs API with chunking for large texts
   */
  async convertTextToSpeech(request: TextToSpeechRequest): Promise<string> {
    if (!this.elevenLabsConfig.apiKey) {
      throw new Error('ElevenLabs API key is not configured');
    }

    // Step 1: Validate request parameters (empty check, voice check)
    this.validateTextToSpeechRequest(request);

    const { text, voiceId, title } = request;
    const maxChunkSize = audioConfig.maxChunkSize || 10000;

    // Step 2: Chunk the text if needed
    const textChunks = this.splitTextIntoChunks(text, maxChunkSize);
    if (textChunks.length === 0) {
      throw new Error('Text cannot be empty after chunking');
    }

    // Step 3: Convert each chunk to speech and combine results if needed
    const { elevenLabsService } = await import('./elevenLabsService');
    const fileName = elevenLabsService.generateUniqueFilename(title, voiceId);
    const filePath = path.join(audioDir, fileName);

    // If only one chunk, use the original logic
    if (textChunks.length === 1) {
      // Check for cache
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.size > 0) {
          console.log(`Audio file ${fileName} already exists with size ${stats.size} bytes, returning cached version`);
          return `${publicAudioPrefix}/${fileName}`;
        } else {
          console.log(`Audio file ${fileName} exists but is empty (size: ${stats.size} bytes), regenerating`);
        }
      }
      ensureDirectoryExists(audioDir);
      try {
        const result = await elevenLabsService.generateAudio(textChunks[0], voiceId, fileName);
        if (result.success) {
          await this.updateVoiceAnalytics(voiceId);
          return `${publicAudioPrefix}/${fileName}`;
        } else {
          throw new Error(result.error || 'Failed to generate audio');
        }
      } catch (error: any) {
        // Log the error but re-throw it to trigger retry logic
        console.error('Error generating audio:', error);
        throw error;
      }
    } else {
      // Multiple chunks: generate audio for each chunk and concatenate
      const chunkFileNames: string[] = [];
      for (let i = 0; i < textChunks.length; i++) {
        const chunkFileName = elevenLabsService.generateUniqueFilename(`${title}_chunk${i+1}`, voiceId);
        const chunkFilePath = path.join(audioDir, chunkFileName);
        if (!fs.existsSync(chunkFilePath) || fs.statSync(chunkFilePath).size === 0) {
          try {
            const result = await elevenLabsService.generateAudio(textChunks[i], voiceId, chunkFileName);
            if (!result.success) {
              throw new Error(result.error || `Failed to generate audio for chunk ${i+1}`);
            }
          } catch (error: any) {
            throw new Error('Audio generation failed; error details: ' + error.message);
          }
        }
        chunkFileNames.push(chunkFileName);
      }
      // Concatenate all chunk files into one final file
      ensureDirectoryExists(audioDir);
      
      // Create the final file with the first chunk
      const firstChunkPath = path.join(audioDir, chunkFileNames[0]);
      if (fs.existsSync(firstChunkPath)) {
        await fs.promises.copyFile(firstChunkPath, filePath);
      } else {
        throw new Error(`First chunk file ${chunkFileNames[0]} not found`);
      }

      // Sequentially append remaining chunks
      for (let i = 1; i < chunkFileNames.length; i++) {
        const chunkFilePath = path.join(audioDir, chunkFileNames[i]);
        if (fs.existsSync(chunkFilePath)) {
          const chunkData = await fs.promises.readFile(chunkFilePath);
          await fs.promises.appendFile(filePath, chunkData);
        } else {
          console.warn(`Chunk file ${chunkFileNames[i]} not found, skipping`);
        }
      }
      
      // Clean up chunk files after successful concatenation
      for (const chunkFileName of chunkFileNames) {
        const chunkFilePath = path.join(audioDir, chunkFileName);
        if (fs.existsSync(chunkFilePath)) {
          await fs.promises.unlink(chunkFilePath).catch(err => 
            console.warn(`Failed to delete chunk file ${chunkFileName}:`, err)
          );
        }
      }
      
      await this.updateVoiceAnalytics(voiceId);
      return `${publicAudioPrefix}/${fileName}`;
    }
  }

  /**
   * Convert text to speech with automatic retry on failure
   * @param request The text to speech request
   * @param attempts Maximum number of retry attempts
   * @returns Promise resolving to the audio file path
   * @throws Error if all retry attempts fail
   */
  async convertTextToSpeechWithRetry(request: TextToSpeechRequest, attempts = audioConfig.retryAttempts): Promise<string> {
    for (let i = 0; i < attempts; i++) {
      try {
        return await this.convertTextToSpeech(request);
      } catch (error) {
        if (i === attempts - 1) throw error;
        const baseDelay = Math.min(audioConfig.retryDelay * Math.pow(2, i), audioConfig.maxRetryDelay);
        // Add ±20% jitter to prevent retry storms
        const jitterFactor = 0.8 + Math.random() * 0.4; // Random number between 0.8 and 1.2
        const delay = Math.floor(baseDelay * jitterFactor);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Max retry attempts reached');
  }

  /**
   * Generate audio files for chapters using ElevenLabs API
   */
  async generateAudio(
    chapter: ChapterDTO, 
    voiceId: string
  ): Promise<InsertChapter> {
    try {
      console.log(`Generating audio for chapter "${chapter.title}" using voice "${voiceId}"`);
      console.log(`Chapter text length: ${chapter.text.length} characters`);
      
      // Convert chapter text to audio - our improved convertTextToSpeech now handles chunking
      const audioUrl = await this.convertTextToSpeechWithRetry({
        text: chapter.text,
        voiceId,
        title: chapter.title
      });
      
      console.log(`Generated audio URL: ${audioUrl}`);
      
      // Get file stats if it exists
      let duration = 0;
      let size = 0;
      
      const audioFilePath = path.join(process.cwd(), audioUrl.substring(1));
      if (fs.existsSync(audioFilePath)) {
        const stats = fs.statSync(audioFilePath);
        size = stats.size;
        
        // Estimate duration: ~1 second per 1.5KB for MP3 files at 128kbps
        duration = Math.ceil(size / 1500);
        console.log(`Audio file exists. Size: ${size} bytes, Duration: ${duration} seconds`);
      } else {
        // Fallback to estimation if file doesn't exist
        const wordCount = chapter.text.split(/\s+/).length;
        duration = Math.floor(wordCount / 3); // ~3 words per second reading speed
        size = Math.floor(chapter.text.length / 10) * 1024; // ~0.1KB per character
        console.log(`Audio file not found. Using estimation. Duration: ${duration} seconds, Size: ${size} bytes`);
      }
      
      // Create chapter data for storage
      const result = {
        title: chapter.title,
        audioUrl,
        duration,
        size,
        createdAt: new Date().toISOString()
      };
      
      console.log(`Chapter data prepared:`, result);
      return result;
    } catch (error) {
      console.error('Error generating audio:', error);
      throw error;
    }
  }
  
  /**
   * Get the file path for an audio file
   */
  getAudioFilePath(filename: string): AudioFileInfo {
    const filePath = path.join(audioDir, filename);
    const exists = fs.existsSync(filePath);
    
    return {
      filePath,
      exists
    };
  }
  
  /**
   * Update voice usage analytics
   */
  private async updateVoiceAnalytics(voiceId: string): Promise<void> {
    const analytics = await storage.getAnalytics();
    if (analytics) {
      // Create a safe copy of voice usage
      const voiceUsageData = analytics.voiceUsage as Record<string, number>;
      const voiceUsage = { ...voiceUsageData };
      voiceUsage[voiceId] = (voiceUsage[voiceId] || 0) + 1;
      
      // Safely get the current conversions count
      const conversions = analytics.conversions || 0;
      
      await storage.updateAnalytics({
        conversions: conversions + 1,
        voiceUsage
      });
    }
  }
}

export const audioService = new AudioService();