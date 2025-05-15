/**
 * ElevenLabs Service
 * 
 * This service handles direct integration with the ElevenLabs API using their official SDK
 */
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
// Import based on official GitHub examples from elevenlabs-js
import { ElevenLabs } from 'elevenlabs';

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

// Define voice settings interface based on ElevenLabs documentation
interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

class ElevenLabsService {
  private client: any = null;
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
      try {
        // Use require instead of import to avoid TypeScript errors
        const elevenlabs = require('elevenlabs');
        this.client = new elevenlabs.ElevenLabs({
          apiKey: this.config.apiKey,
        });
        console.log('ElevenLabs client initialized with API key');
      } catch (error) {
        console.error('Error initializing ElevenLabs client:', error);
      }
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
      console.log('API key validation successful', voices ? 'voices found' : 'no voices found');
      return !!voices;
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
      
      // Define voice settings
      const voiceSettings = {
        stability: 0.5,
        similarity_boost: 0.5,
        style: 0.0,
        use_speaker_boost: true
      };
      
      try {
        // Generate audio using the SDK
        const audio = await this.client.generate({
          voice: elevenLabsVoiceId,
          text: text,
          model_id: "eleven_multilingual_v2",
          voice_settings: voiceSettings
        });
        
        // Write the audio buffer to a file
        fs.writeFileSync(filePath, audio);
        
        // Check if the file was created successfully and has content
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          if (stats.size > 0) {
            console.log(`Audio file successfully saved at ${filePath} (${stats.size} bytes)`);
            return {
              success: true,
              filePath,
            };
          } else {
            console.error('File was created but is empty');
            return {
              success: false,
              filePath,
              error: 'Audio file is empty, possibly due to API quota limitations'
            };
          }
        } else {
          console.error('Failed to create audio file');
          return {
            success: false,
            filePath,
            error: 'Failed to create audio file'
          };
        }
      } catch (generateError: any) {
        console.error('Error in ElevenLabs generate method:', generateError);
        
        // Try alternative approach for older SDK versions
        if (this.client.textToSpeech) {
          console.log('Trying alternative textToSpeech method...');
          try {
            const result = await this.client.textToSpeech.convert(elevenLabsVoiceId, {
              text,
              model_id: "eleven_multilingual_v2",
              voice_settings: voiceSettings
            });
            
            // Create file stream and pipe the audio data
            const fileStream = fs.createWriteStream(filePath);
            result.pipe(fileStream);
            
            return new Promise((resolve) => {
              fileStream.on('finish', () => {
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
                console.error('File stream error:', err);
                resolve({
                  success: false,
                  filePath,
                  error: `File stream error: ${err.message}`
                });
              });
            });
          } catch (textToSpeechError) {
            throw textToSpeechError; // Pass to main error handler
          }
        } else {
          throw generateError; // Pass to main error handler
        }
      }
    } catch (error: any) {
      console.error('Error generating audio with ElevenLabs:', error);
      
      // Create an empty placeholder file
      fs.writeFileSync(filePath, Buffer.from(''));
      
      // Try to extract detailed error information
      let errorMessage = 'Unknown error';
      if (error.statusCode) {
        errorMessage = `Status code: ${error.statusCode}`;
        if (error.message) {
          errorMessage += ` - ${error.message}`;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      if (error.statusCode === 401) {
        errorMessage = "API key is invalid or has expired (401 Unauthorized)";
      } else if (error.statusCode === 429) {
        errorMessage = "API quota exceeded or rate limit reached (429 Too Many Requests)";
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