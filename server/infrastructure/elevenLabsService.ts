/**
 * ElevenLabs Service
 * 
 * This service handles direct integration with the ElevenLabs API using their official SDK
 */
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';

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
    
    // We don't initialize the client in the constructor anymore
    // Instead, we create a new client for each API call using dynamic imports
  }
  
  /**
   * Helper method to check if the API key is configured
   */
  private isApiKeyConfigured(): boolean {
    const configured = !!this.config.apiKey && this.config.apiKey.length > 0;
    if (!configured) {
      console.warn('No ElevenLabs API key found. Voice synthesis will not work.');
    }
    return configured;
  }
  
  /**
   * Check if the API key is valid by making a test request
   */
  async checkApiKeyValidity(): Promise<boolean> {
    if (!this.isApiKeyConfigured()) {
      return false;
    }
    
    try {
      // Import ElevenLabs SDK dynamically
      const elevenlabs = await import('elevenlabs');
      
      try {
        // Use the SDK's static methods that accept apiKey parameter
        const voices = await elevenlabs.voices.getAll({ 
          apiKey: this.config.apiKey 
        });
        
        console.log('API key validation successful', voices ? 'voices found' : 'no voices found');
        return Array.isArray(voices) && voices.length > 0;
      } catch (error) {
        console.error('Error checking ElevenLabs API key validity:', error);
        return false;
      }
    } catch (importError) {
      console.error('Error importing ElevenLabs SDK:', importError);
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
        // Import the ElevenLabs SDK dynamically
        const elevenlabs = await import('elevenlabs');
        
        // Create a new client instance specifically for this request
        // to avoid issues with the async initialization
        const client = new elevenlabs.ElevenLabs({
          apiKey: this.config.apiKey
        });
        
        // Generate audio using the SDK
        console.log('Generating audio with dynamic ElevenLabs client...');
        const audio = await client.generate({
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
        
        // Create a more descriptive error message
        let detailedError = 'Unknown ElevenLabs SDK error';
        
        if (generateError.statusCode) {
          detailedError = `HTTP Error ${generateError.statusCode}`;
          
          // Add specific error handling
          if (generateError.statusCode === 401) {
            detailedError = 'Invalid or expired API key (401 Unauthorized)';
          } else if (generateError.statusCode === 429) {
            detailedError = 'API rate limit exceeded (429 Too Many Requests)';
          }
        } else if (generateError.message) {
          detailedError = generateError.message;
        }
        
        console.error('Detailed error:', detailedError);
        
        return {
          success: false,
          filePath,
          error: `ElevenLabs API error: ${detailedError}`
        };
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