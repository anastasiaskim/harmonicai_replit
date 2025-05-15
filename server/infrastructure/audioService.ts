/**
 * Infrastructure Layer: Audio Service
 * Handles audio generation and audio file management
 */
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { storage } from '../storage';
import { fileService } from './fileService';
import { ChapterDTO } from './chapterService';
import { InsertChapter } from '@shared/schema';

const uploadDir = path.resolve(process.cwd(), 'uploads');

export interface ElevenLabsConfig {
  apiKey: string;
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

class AudioService {
  private elevenLabsConfig: ElevenLabsConfig = {
    apiKey: process.env.ELEVENLABS_API_KEY || '',
    voiceMapping: {
      rachel: "EXAVITQu4vr4xnSDxMaL",
      thomas: "TxGEqnHWrfWFTfGW9XjX",
      emily: "D38z5RcWu1voky8WS1ja",
      james: "pNInz6obpgDQGcFmaJgB"
    }
  };

  /**
   * Generate audio files for chapters using ElevenLabs API
   */
  async generateAudio(
    chapter: ChapterDTO, 
    voiceId: string,
    enableRealApiCall: boolean = true
  ): Promise<InsertChapter> {
    // Get ElevenLabs voice ID from our mapping
    const elevenLabsVoiceId = this.elevenLabsConfig.voiceMapping[voiceId] || 
                              this.elevenLabsConfig.voiceMapping.rachel;
    
    // Create unique filename based on content hash
    const contentHash = createHash('md5').update(chapter.text).digest('hex');
    const fileName = `${voiceId}_${contentHash}.mp3`;
    const filePath = path.join(uploadDir, fileName);
    
    if (enableRealApiCall && this.elevenLabsConfig.apiKey) {
      try {
        // In a real implementation, we would make the API call to ElevenLabs here
        // Example ElevenLabs API call structure (not implemented for MVP)
        /*
        const response = await axios.post(
          `https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}`,
          {
            text: chapter.text,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5
            }
          },
          {
            headers: {
              'Accept': 'audio/mpeg',
              'xi-api-key': this.elevenLabsConfig.apiKey,
              'Content-Type': 'application/json'
            },
            responseType: 'arraybuffer'
          }
        );
        
        // Save the audio file
        fs.writeFileSync(filePath, Buffer.from(response.data));
        */
      } catch (error) {
        console.error('Error calling ElevenLabs API:', error);
        throw new Error('Failed to generate audio with ElevenLabs API');
      }
    }
    
    // For MVP, create an empty file if it doesn't exist or real API call failed
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, Buffer.from(''));
    }
    
    // Calculate audio metrics
    const wordCount = chapter.text.split(/\s+/).length;
    const durationInSeconds = Math.floor(wordCount / 3); // ~3 words per second reading speed
    const size = Math.floor(chapter.text.length / 10) * 1024; // ~0.1KB per character
    
    // Create chapter data for storage
    return {
      title: chapter.title,
      audioUrl: `/api/audio/${fileName}`,
      duration: durationInSeconds,
      size: size,
      createdAt: new Date().toISOString()
    };
  }
  
  /**
   * Get the file path for an audio file
   */
  getAudioFilePath(filename: string): AudioFileInfo {
    const filePath = path.join(uploadDir, filename);
    const exists = fs.existsSync(filePath);
    
    return {
      filePath,
      exists
    };
  }
  
  /**
   * Update voice usage analytics
   */
  async updateVoiceAnalytics(voiceId: string): Promise<void> {
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