/**
 * ElevenLabs Service
 * 
 * This service handles direct integration with the ElevenLabs API using their official SDK
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { v4 as uuid } from 'uuid';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { RateLimiter } from 'limiter';

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
  rateLimit?: {
    tokensPerInterval: number;
    interval: number;
  };
}

// Define voice settings interface based on ElevenLabs documentation
interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

interface Result {
  success: boolean;
  filePath: string;
  error?: string;
}

class ElevenLabsService {
  private client: any = null;
  private config: ElevenLabsConfig;
  private audioCache = new Map<string, string>();
  private rateLimiter: RateLimiter;
  
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
    
    // Default rate limit configuration (50 requests per minute)
    const defaultRateLimit = {
      tokensPerInterval: 50,
      interval: 60 * 1000 // 60 seconds in milliseconds
    };
    
    this.config = {
      apiKey: process.env.ELEVENLABS_API_KEY || '',
      voiceMapping,
      rateLimit: defaultRateLimit
    };
    
    // Initialize rate limiter
    this.rateLimiter = new RateLimiter({
      tokensPerInterval: this.config.rateLimit?.tokensPerInterval || defaultRateLimit.tokensPerInterval,
      interval: this.config.rateLimit?.interval || defaultRateLimit.interval
    });
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
      // Create a simple test request directly to the ElevenLabs API
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'xi-api-key': this.config.apiKey
        }
      });
      
      if (!response.ok) {
        console.error(`API key validation failed with status: ${response.status}`);
        return false;
      }
      
      const data = await response.json();
      console.log('API key validation successful:', data.voices ? 'voices found' : 'no voices found');
      return Array.isArray(data.voices) && data.voices.length > 0;
    } catch (error) {
      console.error('Error checking ElevenLabs API key validity:', error);
      return false;
    }
  }
  
  /**
   * Wait for rate limit token with timeout
   */
  private async waitForRateLimitToken(timeoutMs: number = 5000): Promise<boolean> {
    try {
      await this.rateLimiter.removeTokens(1);
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('RateLimiter timeout')) {
        console.warn('Rate limit token acquisition timed out');
        return false;
      }
      throw error;
    }
  }
  
  /**
   * Generate audio file from text using ElevenLabs API
   */
  async generateAudio(
    text: string, 
    voiceId: string, 
    fileName: string
  ): Promise<Result> {
    // Wait for rate limit token with timeout
    const hasToken = await this.waitForRateLimitToken();
    if (!hasToken) {
      return {
        success: false,
        filePath: '',
        error: 'Rate limit exceeded. Please try again later.'
      };
    }

    if (!this.isApiKeyConfigured()) {
      return { 
        success: false, 
        filePath: '', 
        error: 'ElevenLabs API key not configured' 
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
      const voiceSettings: VoiceSettings = {
        stability: 0.5,
        similarity_boost: 0.5,
        style: 0.0,
        use_speaker_boost: true
      };
      
      try {
        // Instead of using the SDK, we'll use direct API calls for better control
        console.log('Using direct API call to generate audio');
        
        // Create request body
        const requestBody = {
          text: text,
          model_id: "eleven_multilingual_v2",
          voice_settings: voiceSettings
        };
        
        // Make direct request to ElevenLabs API
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}`, {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.config.apiKey
          },
          body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
          throw new Error(`API request failed with status: ${response.status}`);
        }
        
        // Get audio buffer from response
        const audio = new Uint8Array(await response.arrayBuffer());
        
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
        
        // Try alternative method with streaming if the main method failed
        try {
          console.log('Trying alternative streaming TTS method...');
          
          // Create a file stream to write the audio data
          const fileStream = fs.createWriteStream(filePath);
          
          // Use alternative API endpoint with streaming response
          // Split text into smaller chunks if it's too large
          const maxChunkSize = 5000; // Max characters per chunk
          
          // Split text intelligently at sentence boundaries to avoid token limits
          // The splitTextIntoSentenceChunks method doesn't exist yet, so use a simple chunking approach
          const textChunks: string[] = [];
          let i = 0;
          while (i < text.length) {
            const chunk = text.slice(i, i + maxChunkSize);
            if (chunk) textChunks.push(chunk);
            i += maxChunkSize;
          }
          
          console.log(`Split text into ${textChunks.length} chunks for streaming`);
          
          // Create a temp directory for chunk files
          const tempDir = path.join(process.cwd(), 'temp_audio');
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          
          // Array to store paths to temporary audio chunk files
          const chunkFilePaths: string[] = [];
          
          // Process each chunk sequentially
          for (let i = 0; i < textChunks.length; i++) {
            const chunkToProcess = textChunks[i];
            const chunkFileName = `chunk_${i}_${path.basename(filePath)}`;
            const chunkFilePath = path.join(tempDir, chunkFileName);
            
            console.log(`Processing chunk ${i+1}/${textChunks.length} (${chunkToProcess.length} chars)`);
            
            // Create request body for streaming
            const streamRequestBody = {
              text: chunkToProcess,
              model_id: "eleven_multilingual_v2",
              voice_settings: voiceSettings,
              output_format: "mp3_44100_128"
            };
            
            try {
              // Make streaming request to ElevenLabs API
              const streamResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}/stream`, {
                method: 'POST',
                headers: {
                  'Accept': 'audio/mpeg',
                  'Content-Type': 'application/json',
                  'xi-api-key': this.config.apiKey
                },
                body: JSON.stringify(streamRequestBody)
              });
              
              if (!streamResponse.ok) {
                console.error(`Chunk ${i+1} failed with status: ${streamResponse.status}`);
                continue; // Skip to next chunk rather than failing completely
              }
              
              await this.handleStreamResponse(streamResponse, chunkFilePath);
              chunkFilePaths.push(chunkFilePath);
              
              console.log(`Saved chunk ${i+1} to ${chunkFilePath}`);
            } catch (chunkError) {
              console.error(`Error processing chunk ${i+1}:`, chunkError);
              // Continue with next chunk rather than failing completely
            }
            
            // Add a small delay between API calls to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          if (chunkFilePaths.length === 0) {
            throw new Error('Failed to process any chunks successfully');
          }
          
          // Now combine all chunks into the final output file
          try {
            // Create the output file stream
            const outputStream = fs.createWriteStream(filePath);
            
            // Append each chunk file to the output file
            for (const chunkPath of chunkFilePaths) {
              const chunkData = fs.readFileSync(chunkPath);
              outputStream.write(chunkData);
            }
            
            // Close the output stream
            outputStream.end();
            
            // Clean up temporary files
            for (const chunkPath of chunkFilePaths) {
              try {
                fs.unlinkSync(chunkPath);
              } catch (e) {
                console.warn(`Could not delete temporary file ${chunkPath}:`, e);
              }
            }
            
            // Try to clean up the temp directory
            try {
              fs.rmdirSync(tempDir);
            } catch (e) {
              console.warn('Could not delete temporary directory:', e);
            }
          } catch (combineError) {
            console.error('Error combining audio chunks:', combineError);
            throw new Error(`Failed to combine audio chunks: ${combineError}`);
          }
          
          return new Promise((resolve) => {
            fileStream.on('finish', () => {
              if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (stats.size > 0) {
                  console.log(`Audio file successfully saved using alternative method at ${filePath} (${stats.size} bytes)`);
                  resolve({ success: true, filePath });
                } else {
                  console.error('File was created but is empty (alternative method)');
                  resolve({
                    success: false,
                    filePath,
                    error: 'Audio file is empty, possibly due to API quota limitations'
                  });
                }
              } else {
                resolve({
                  success: false,
                  filePath,
                  error: 'Failed to create audio file with alternative method'
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
        } catch (fallbackError) {
          console.error('Alternative method also failed:', fallbackError);
          
          // Create an empty placeholder file
          this.createEmptyFile(filePath);
          
          return {
            success: false,
            filePath,
            error: `ElevenLabs API error: ${detailedError}. Fallback also failed.`
          };
        }
      }
    } catch (error: any) {
      console.error('Error generating audio with ElevenLabs:', error);
      
      // Create an empty placeholder file
      this.createEmptyFile(filePath);
      
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
  
  /**
   * Split text into chunks, respecting sentence boundaries when possible
   * @param text The full text to split
   * @param maxChunkSize Maximum size of each chunk (characters)
   * @returns Array of text chunks
   */
  splitTextIntoSentenceChunks(text: string, maxChunkSize: number = 5000): string[] {
    // Ensure we stay well below the 10,000 character limit for eleven_multilingual_v2
    // We use 5,000 by default for safety
    
    // If text is already small enough, return it as a single chunk
    if (text.length <= maxChunkSize) {
      return [text];
    }
    
    const chunks: string[] = [];
    let currentChunk = '';
    
    // Split the text by sentences
    // This regex matches sentence endings (period, question mark, exclamation followed by space or newline)
    const sentences = text.split(/(?<=[.!?])\s+/);
    
    for (const sentence of sentences) {
      // If single sentence exceeds max chunk size, split it further
      if (sentence.length > maxChunkSize) {
        // If current chunk has content, add it to chunks first
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = '';
        }
        
        // Split long sentence by paragraphs or simply by size if needed
        const paragraphs = sentence.split(/\n\s*\n/);
        
        for (const paragraph of paragraphs) {
          if (paragraph.length <= maxChunkSize) {
            // If paragraph fits in a chunk, add it
            if (currentChunk.length + paragraph.length + 1 <= maxChunkSize) {
              currentChunk += (currentChunk ? ' ' : '') + paragraph;
            } else {
              chunks.push(currentChunk);
              currentChunk = paragraph;
            }
          } else {
            // If paragraph is too big, we need to split it arbitrarily
            // First add current chunk if it has content
            if (currentChunk.length > 0) {
              chunks.push(currentChunk);
              currentChunk = '';
            }
            
            // Then split the paragraph into fixed-size chunks
            // Try to split on commas or spaces when possible
            let paraIndex = 0;
            while (paraIndex < paragraph.length) {
              let chunkEndIndex = Math.min(paraIndex + maxChunkSize, paragraph.length);
              
              // Try to find a good breaking point (comma or space)
              if (chunkEndIndex < paragraph.length) {
                // Look for comma followed by space
                const commaIndex = paragraph.lastIndexOf(', ', chunkEndIndex);
                if (commaIndex > paraIndex && (chunkEndIndex - commaIndex) < 100) {
                  chunkEndIndex = commaIndex + 1; // Include the comma
                } else {
                  // If no comma, try to break at a space
                  const spaceIndex = paragraph.lastIndexOf(' ', chunkEndIndex);
                  if (spaceIndex > paraIndex && (chunkEndIndex - spaceIndex) < 50) {
                    chunkEndIndex = spaceIndex;
                  }
                  // Otherwise, just break at the max size
                }
              }
              
              chunks.push(paragraph.substring(paraIndex, chunkEndIndex).trim());
              paraIndex = chunkEndIndex;
            }
          }
        }
      } else {
        // Normal case: add sentence to current chunk if it fits
        if (currentChunk.length + sentence.length + 1 <= maxChunkSize) {
          currentChunk += (currentChunk ? ' ' : '') + sentence;
        } else {
          // If doesn't fit, start a new chunk
          chunks.push(currentChunk);
          currentChunk = sentence;
        }
      }
    }
    
    // Add the last chunk if it has content
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    // Log information about the chunking
    console.log(`Split text (${text.length} chars) into ${chunks.length} chunks`);
    for (let i = 0; i < chunks.length; i++) {
      console.log(`  Chunk ${i+1}: ${chunks[i].length} chars`);
    }
    
    return chunks;
  }

  async generateAudioWithCache(text: string, voiceId: string): Promise<string> {
    const cacheKey = `${voiceId}-${createHash(text)}`;
    if (this.audioCache.has(cacheKey)) {
      return this.audioCache.get(cacheKey)!;
    }
    const result = await this.generateAudio(text, voiceId, this.generateUniqueFilename(text, voiceId));
    this.audioCache.set(cacheKey, result.filePath);
    return result.filePath;
  }

  private async handleStreamResponse(streamResponse: Response, chunkFilePath: string): Promise<void> {
    if (streamResponse.body) {
      // Convert the response to a buffer and write to chunk file
      const buffer = new Uint8Array(await streamResponse.arrayBuffer());
      fs.writeFileSync(chunkFilePath, buffer);
    }
  }

  private createEmptyFile(filePath: string): void {
    fs.writeFileSync(filePath, new Uint8Array(0));
  }

  /**
   * Update rate limit configuration
   */
  updateRateLimit(tokensPerInterval: number, interval: number): void {
    this.config.rateLimit = { tokensPerInterval, interval };
    this.rateLimiter = new RateLimiter({
      tokensPerInterval,
      interval
    });
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): { remaining: number; resetTime: number } {
    const remaining = this.rateLimiter.getTokensRemaining();
    // Since we can't get the exact reset time, we'll return the interval
    const resetTime = this.config.rateLimit?.interval || 60000;
    return { remaining, resetTime };
  }
}

// Export singleton instance
export const elevenLabsService = new ElevenLabsService();