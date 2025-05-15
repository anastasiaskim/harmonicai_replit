/**
 * Infrastructure Layer: Audio Service
 * Handles audio generation and audio file management
 */
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import axios from 'axios';
import { storage } from '../storage';
import { fileService } from './fileService';
import { ChapterDTO } from './chapterService';
import { InsertChapter } from '@shared/schema';

// Ensure uploads directory exists
const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Ensure audio directory exists
const audioDir = path.resolve(process.cwd(), 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

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
    apiUrl: 'https://api.elevenlabs.io/v1',
    voiceMapping: {
      rachel: "EXAVITQu4vr4xnSDxMaL",
      thomas: "TxGEqnHWrfWFTfGW9XjX",
      emily: "D38z5RcWu1voky8WS1ja",
      james: "pNInz6obpgDQGcFmaJgB"
    }
  };

  /**
   * Convert text to speech using ElevenLabs API
   */
  async convertTextToSpeech(request: TextToSpeechRequest): Promise<string> {
    if (!this.elevenLabsConfig.apiKey) {
      throw new Error('ElevenLabs API key is not configured');
    }

    const { text, voiceId, title } = request;
    
    // Get ElevenLabs voice ID from our mapping
    const elevenLabsVoiceId = this.elevenLabsConfig.voiceMapping[voiceId] || 
                              this.elevenLabsConfig.voiceMapping.rachel;
    
    // Create unique filename based on content hash
    const contentHash = createHash('md5').update(text).digest('hex');
    const safeTitle = title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').toLowerCase();
    const fileName = `${safeTitle}_${voiceId}_${contentHash.substring(0, 8)}.mp3`;
    const filePath = path.join(audioDir, fileName);
    
    // Check if file already exists (cache hit)
    if (fs.existsSync(filePath)) {
      console.log(`Audio file ${fileName} already exists, returning cached version`);
      return `/audio/${fileName}`;
    }
    
    // Make API call to ElevenLabs
    try {
      console.log(`Calling ElevenLabs API for voice ${voiceId} (${elevenLabsVoiceId})`);
      
      const response = await axios.post(
        `${this.elevenLabsConfig.apiUrl}/text-to-speech/${elevenLabsVoiceId}`,
        {
          text,
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
      
      // Update analytics
      await this.updateVoiceAnalytics(voiceId);
      
      return `/audio/${fileName}`;
    } catch (error: any) {
      console.error('Error calling ElevenLabs API:', error?.response?.status, error?.response?.statusText || error);
      
      // If in development mode, create a mock audio file for testing
      if (process.env.NODE_ENV === 'development') {
        // Create an empty file as a placeholder
        fs.writeFileSync(filePath, Buffer.from(''));
        console.log(`Created empty placeholder file for ${fileName} in development mode`);
        return `/audio/${fileName}`;
      }
      
      throw new Error(`Failed to generate audio: ${error?.response?.statusText || error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Generate audio files for chapters using ElevenLabs API
   */
  async generateAudio(
    chapter: ChapterDTO, 
    voiceId: string,
    enableRealApiCall: boolean = true
  ): Promise<InsertChapter> {
    try {
      // Convert chapter text to audio
      const audioUrl = await this.convertTextToSpeech({
        text: chapter.text,
        voiceId,
        title: chapter.title
      });
      
      // Get file stats if it exists
      let duration = 0;
      let size = 0;
      
      const audioFilePath = path.join(process.cwd(), audioUrl.substring(1));
      if (fs.existsSync(audioFilePath)) {
        const stats = fs.statSync(audioFilePath);
        size = stats.size;
        
        // Estimate duration: ~1 second per 1.5KB for MP3 files at 128kbps
        duration = Math.ceil(size / 1500);
      } else {
        // Fallback to estimation if file doesn't exist
        const wordCount = chapter.text.split(/\s+/).length;
        duration = Math.floor(wordCount / 3); // ~3 words per second reading speed
        size = Math.floor(chapter.text.length / 10) * 1024; // ~0.1KB per character
      }
      
      // Create chapter data for storage
      return {
        title: chapter.title,
        audioUrl,
        duration,
        size,
        createdAt: new Date().toISOString()
      };
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