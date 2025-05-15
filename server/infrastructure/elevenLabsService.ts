/**
 * ElevenLabs Service
 * 
 * This service handles direct integration with the ElevenLabs API using their official SDK
 */
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { ElevenLabsClient } from 'elevenlabs';
import { Readable } from 'stream';

// Get audio directory (create if needed)
const audioDir = path.join(process.cwd(), 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

// Configuration for ElevenLabs
interface ElevenLabsConfig {
  apiKey: string;
  voiceMapping: {
    [key: string]: string;
  };
}

class ElevenLabsService {
  private client: ElevenLabsClient | null = null;
  private config: ElevenLabsConfig;
  
  constructor() {
    // Default voice mapping
    const voiceMapping: {[key: string]: string} = {
      // Map our internal voice IDs to ElevenLabs voice IDs
      rachel: 'EXAVITQu4vr4xnSDxMaL', // Rachel
      thomas: 'N2lVS1w4EtoT3dr4eOWO', // Clyde
      emily: 'jsCqWAovK2LkecY7zXl4',  // Grace
      michael: 'pNInz6obpgDQGcFmaJgB', // Adam
      defaultVoice: 'EXAVITQu4vr4xnSDxMaL' // Rachel as default
    };
    
    this.config = {
      apiKey: process.env.ELEVENLABS_API_KEY || '',
      voiceMapping
    };
    
    this.initClient();
  }
  
  private initClient() {
    if (this.config.apiKey) {
      this.client = new ElevenLabsClient({
        apiKey: this.config.apiKey,
      });
      console.log('ElevenLabs client initialized with API key');
    } else {
      console.warn('No ElevenLabs API key found. Voice synthesis will not work.');
    }
  }
  
  /**
   * Check if the API key is valid by making a test request
   */
  async checkApiKeyValidity(): Promise<boolean> {
    if (!this.client) {
      console.error('ElevenLabs client not initialized');
      return false;
    }
    
    try {
      // Make a simple request to check if the API key is valid
      const voices = await this.client.voices.getAll();
      return voices && Array.isArray(voices.voices);
    } catch (error) {
      console.error('Error checking ElevenLabs API key validity:', error);
      return false;
    }
  }
  
  /**
   * Generate audio file from text using ElevenLabs API
   */
  async generateAudio(
    text: string, 
    voiceId: string, 
    fileName: string
  ): Promise<{ success: boolean; filePath: string; error?: string }> {
    if (!this.client) {
      return { 
        success: false, 
        filePath: '', 
        error: 'ElevenLabs client not initialized' 
      };
    }
    
    // Map our voice ID to ElevenLabs voice ID
    const elevenLabsVoiceId = 
      this.config.voiceMapping[voiceId] || 
      this.config.voiceMapping.defaultVoice;
    
    const filePath = path.join(audioDir, fileName);
    
    try {
      console.log(`Generating audio with ElevenLabs SDK using voice ID: ${elevenLabsVoiceId}`);
      console.log(`Text length: ${text.length} characters`);
      
      // Generate audio with ElevenLabs API
      const audioStream = await this.client.textToSpeech.convert(elevenLabsVoiceId, {
        model_id: 'eleven_multilingual_v2',
        text,
        output_format: 'mp3_44100_128',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          use_speaker_boost: true,
          speed: 1.0,
        },
      });
      
      // Save to file
      const fileStream = fs.createWriteStream(filePath);
      
      return new Promise((resolve, reject) => {
        if (audioStream instanceof Readable) {
          audioStream.pipe(fileStream);
          
          fileStream.on('finish', () => {
            // Check if the file was created successfully and has content
            const stats = fs.statSync(filePath);
            if (stats.size > 0) {
              console.log(`Audio file successfully saved at ${filePath} (${stats.size} bytes)`);
              resolve({
                success: true,
                filePath,
              });
            } else {
              console.error('File was created but is empty');
              resolve({
                success: false,
                filePath,
                error: 'Audio file is empty, possibly due to API quota limitations'
              });
            }
          });
          
          fileStream.on('error', (err) => {
            console.error(`Error writing audio file: ${err}`);
            resolve({
              success: false,
              filePath,
              error: `File write error: ${err.message}`
            });
          });
        } else {
          console.error('Audio stream is not a readable stream');
          resolve({
            success: false,
            filePath,
            error: 'Invalid audio stream returned from API'
          });
        }
      });
    } catch (error: any) {
      console.error('Error generating audio with ElevenLabs:', error);
      
      // Create an empty placeholder file
      fs.writeFileSync(filePath, Buffer.from(''));
      
      // Try to extract detailed error information
      let errorMessage = 'Unknown error';
      if (error.response && error.response.data) {
        errorMessage = JSON.stringify(error.response.data);
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        filePath,
        error: `ElevenLabs API error: ${errorMessage}`
      };
    }
  }
  
  /**
   * Generate a unique filename for an audio file
   */
  generateUniqueFilename(title: string, voiceId: string): string {
    const safeTitle = title
      .substring(0, 30)
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_')
      .toLowerCase();
    
    const uniqueId = uuid().substring(0, 8);
    return `${safeTitle}_${voiceId}_${uniqueId}.mp3`;
  }
}

// Export singleton instance
export const elevenLabsService = new ElevenLabsService();