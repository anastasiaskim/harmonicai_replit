/**
 * Audio Configuration
 * 
 * This file contains all configuration settings related to audio processing,
 * including text-to-speech, file handling, and rate limiting.
 */

// Audio file format configuration
interface AudioFormat {
  extension: string;
  mimeType: string;
  quality: 'high' | 'medium' | 'low';
  bitrate?: number;
}

// Rate limit configuration
interface RateLimitConfig {
  tokensPerInterval: number;
  interval: number;
}

// Voice settings configuration
interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

// Voice mapping configuration
interface VoiceMapping {
  [key: string]: string;
}

// Main configuration interface
interface AudioConfig {
  // Text processing
  maxChunkSize: number;
  minChunkSize: number;
  sentenceSplitRegex: RegExp;
  
  // File handling
  supportedFormats: AudioFormat[];
  tempDirectory: string;
  outputDirectory: string;
  maxFileSize: number; // in bytes
  
  // Voice settings
  defaultVoice: string;
  defaultVoiceSettings: VoiceSettings;
  voiceMapping: VoiceMapping;
  
  // Retry configuration
  retryAttempts: number;
  retryDelay: number;
  maxRetryDelay: number;
  
  // Cache configuration
  cacheEnabled: boolean;
  cacheDuration: number;
  
  // Rate limiting
  rateLimit: RateLimitConfig;
  
  // API configuration
  apiUrl: string;
  modelId: string;
}

// Audio format definitions
const audioFormats: AudioFormat[] = [
  {
    extension: 'mp3',
    mimeType: 'audio/mpeg',
    quality: 'high',
    bitrate: 128
  },
  {
    extension: 'wav',
    mimeType: 'audio/wav',
    quality: 'high',
    bitrate: 44100
  }
];

// Default voice settings
const defaultVoiceSettings: VoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.5,
  style: 0.0,
  use_speaker_boost: true
};

// Voice mapping configuration
const voiceMapping: VoiceMapping = {
  ana: 'rCmVtv8cYU60uhlsOo1M', // Ana
  benjamin: 'LruHrtVF6PSyGItzMNHS', // Benjamin
  michael: 'uju3wxzG5OhpWcoi3SMy', // Michael C. Vincent
  adeline: '5l5f8iK3YPeGga21rQIX', // Adeline
  // legacy/default voices
  rachel: 'EXAVITQu4vr4xnSDxMaL',
  thomas: 'N2lVS1w4EtoT3dr4eOWO',
  emily: 'jsCqWAovK2LkecY7zXl4',
  james: 'pNInz6obpgDQGcFmaJgB',
  defaultVoice: 'rCmVtv8cYU60uhlsOo1M' // Ana as default
};

// Main configuration object
export const audioConfig: AudioConfig = {
  // Text processing
  maxChunkSize: 4000,
  minChunkSize: 100,
  sentenceSplitRegex: /(?<=[.!?])\s+/,
  
  // File handling
  supportedFormats: audioFormats,
  tempDirectory: 'temp_audio',
  outputDirectory: 'audio',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  
  // Voice settings
  defaultVoice: 'rachel',
  defaultVoiceSettings,
  voiceMapping,
  
  // Retry configuration
  retryAttempts: 3,
  retryDelay: 1000,
  maxRetryDelay: 5000,
  
  // Cache configuration
  cacheEnabled: true,
  cacheDuration: 24 * 60 * 60 * 1000, // 24 hours
  
  // Rate limiting
  rateLimit: {
    tokensPerInterval: 50,
    interval: 60 * 1000 // 60 seconds in milliseconds
  },
  
  // API configuration
  apiUrl: 'https://api.elevenlabs.io/v1',
  modelId: 'eleven_multilingual_v2'
};

// Export types for use in other files
export type { 
  AudioConfig, 
  AudioFormat, 
  RateLimitConfig, 
  VoiceSettings,
  VoiceMapping 
}; 