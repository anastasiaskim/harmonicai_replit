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
import { audioConfig } from '../../config/audio.config';

// Get audio directory (create if needed)
const audioDir = path.join(process.cwd(), audioConfig.outputDirectory);
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
  console.log(`Created directory: ${audioDir}`);
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
    
    // More conservative rate limit configuration (30 requests per minute)
const defaultRateLimit = (() => {
const tokens = parseInt(process.env.ELEVENLABS_TOKENS_PER_INTERVAL ?? '30', 10);
  const interval = parseInt(process.env.ELEVENLABS_RATE_INTERVAL_MS ?? '60000', 10);
  if (Number.isNaN(tokens) || Number.isNaN(interval) || tokens <= 0 || interval <= 0) {
    throw new Error('Invalid ELEVENLABS rate-limit configuration');
  }
  return { tokensPerInterval: tokens, interval };
})();
    
    this.config = {
      apiKey: process.env.ELEVENLABS_API_KEY || '',
      voiceMapping,
      rateLimit: defaultRateLimit
    };
    
    // Initialize rate limiter with more conservative settings
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
   * Wait for rate limit token with timeout (non-blocking)
   */
  private async waitForRateLimitToken(timeoutMs: number = 10000): Promise<boolean> {
    const pollInterval = 100; // ms
    const start = Date.now();
    let attempts = 0;
    
    while (Date.now() - start < timeoutMs) {
      attempts++;
      // Prefer tryRemoveTokens if available
      if (typeof (this.rateLimiter as any).tryRemoveTokens === 'function') {
        if ((this.rateLimiter as any).tryRemoveTokens(1)) {
          console.log(`Rate limit token acquired after ${attempts} attempts`);
          return true;
        }
      } else if (typeof this.rateLimiter.getTokensRemaining === 'function' && this.rateLimiter.getTokensRemaining() > 0) {
        await this.rateLimiter.removeTokens(1);
        console.log(`Rate limit token acquired after ${attempts} attempts`);
        return true;
      }
      
      // Add exponential backoff
      const backoffDelay = Math.min(100 * Math.pow(1.5, attempts), 1000);
      await new Promise(res => setTimeout(res, backoffDelay));
    }
    
    console.warn(`Rate limit token acquisition timed out after ${attempts} attempts`);
    return false;
  }
  
  /**
   * Generate audio file from text using ElevenLabs API
   */
  async generateAudio(
    text: string, 
    voiceId: string, 
    fileName: string
  ): Promise<Result> {
    const startTime = Date.now();
    console.log(`Starting audio generation for ${fileName}`);
    console.log(`Text length: ${text.length} characters`);
    
    // Wait for rate limit token with timeout
    const hasToken = await this.waitForRateLimitToken();
    if (!hasToken) {
      console.error('Rate limit token not available for text-to-speech request');
      return {
        success: false,
        filePath: '',
        error: 'Rate limit exceeded. Please try again later.'
      };
    }

    if (!this.isApiKeyConfigured()) {
      console.error('ElevenLabs API key not configured');
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
      console.log(`Generating audio with ElevenLabs API using voice ID: ${elevenLabsVoiceId}`);
      
      // Define voice settings
      const voiceSettings: VoiceSettings = {
        stability: 0.5,
        similarity_boost: 0.5,
        style: 0.0,
        use_speaker_boost: true
      };
      
      try {
        // Create request body
        const requestBody = {
          text: text,
          model_id: "eleven_multilingual_v2",
          voice_settings: voiceSettings
        };
        
        console.log('Making API request to ElevenLabs...');
        const requestStartTime = Date.now();
        
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
        
        const requestEndTime = Date.now();
        console.log(`API request completed in ${(requestEndTime - requestStartTime) / 1000} seconds`);
        
        if (!response.ok) {
          const errorText = await response.text();
          // Redact or truncate errorText for standard logs
          if (process.env.LOG_LEVEL === 'debug') {
            console.error(`API request failed with status: ${response.status}`, errorText);
          } else {
            const truncated = errorText.length > 200 ? errorText.slice(0, 200) + '...[truncated]' : errorText;
            console.error(`API request failed with status: ${response.status}`, truncated);
          }
          throw new Error(`API request failed with status: ${response.status} - (see logs for details)`);
        }
        
        console.log('Processing API response...');
        const audio = new Uint8Array(await response.arrayBuffer());
        console.log(`Received audio data: ${audio.length} bytes`);
        
        // Write the audio buffer to a file
        await fs.promises.writeFile(filePath, audio);
        
        // Verify the file was written successfully
        try {
          const stats = await fs.promises.stat(filePath);
          if (stats.size > 0) {
            const endTime = Date.now();
            console.log(`Audio file successfully saved at ${filePath} (${stats.size} bytes)`);
            console.log(`Total processing time: ${(endTime - startTime) / 1000} seconds`);
            return { success: true, filePath };
          } else {
            console.error('File was created but is empty');
            return {
              success: false,
              filePath,
              error: 'Audio file is empty'
            };
          }
        } catch (err) {
          console.error('Failed to create audio file', err);
          return {
            success: false,
            filePath,
            error: 'Failed to create audio file'
          };
        }
      } catch (error) {
        console.error('Error in primary audio generation method:', error);
        throw error;
      }
    } catch (error) {
      const endTime = Date.now();
      console.error(`Error in generateAudio after ${(endTime - startTime) / 1000} seconds:`, error);
      return {
        success: false,
        filePath,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
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
    // Create a hash of the text using SHA-256
    const hash = createHash('sha256')
      .update(text)
      .digest('hex');
    
    const cacheKey = `${voiceId}-${hash}`;
    if (this.audioCache.has(cacheKey)) {
      return this.audioCache.get(cacheKey)!;
    }

    const result = await this.generateAudio(text, voiceId, this.generateUniqueFilename(text, voiceId));
    
    // Only cache successful results
    if (result.success) {
      this.audioCache.set(cacheKey, result.filePath);
      return result.filePath;
    } else {
      // If generation failed, throw the error to be handled by the caller
      throw new Error(result.error || 'Failed to generate audio');
    }
  }

  private async handleStreamResponse(streamResponse: Response, chunkFilePath: string): Promise<void> {
    if (streamResponse.body) {
      // Stream the response body directly to the file
      const writable = fs.createWriteStream(chunkFilePath);
      const readable = streamResponse.body as unknown as NodeJS.ReadableStream;
      // Optional: progress reporting
      let bytesWritten = 0;
      readable.on('data', (chunk) => {
        bytesWritten += chunk.length;
        if (bytesWritten % (1024 * 100) < chunk.length) { // Every ~100KB
          console.log(`Streaming audio chunk: ${bytesWritten} bytes written to ${chunkFilePath}`);
        }
      });
      await new Promise<void>((resolve, reject) => {
        readable.pipe(writable);
        writable.on('finish', resolve);
        writable.on('error', reject);
        readable.on('error', reject);
      });
    }
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