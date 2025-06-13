import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the equivalent of __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  bitrate?: number;  // For compressed formats like MP3
  sampleRate?: number;  // For uncompressed formats like WAV
}

// Rate limit configuration
interface RateLimitConfig {
  // Token bucket rate limiting (for general API protection)
  tokensPerInterval: number;
  interval: number;
  
  // Concurrency limiting (for ElevenLabs API)
  maxConcurrent: number;
  minConcurrent: number;
  concurrencyWindow: number; // Time window in ms to measure concurrency
  concurrencyBackoff: number; // Backoff factor when hitting limits
  
  // Dynamic throttling
  enableDynamicThrottling: boolean;
  throttleThreshold: number; // Percentage of max concurrency to start throttling
  throttleStep: number; // How much to reduce concurrency by when throttling
  throttleRecovery: number; // How much to increase concurrency by when recovering
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
  publicPath?: string; // Optional public URL prefix
  
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

// Base directory configuration
const BASE_DIR = process.env.AUDIO_BASE_DIR || path.resolve(__dirname, '..');
const ensureDirectory = (dirPath: string): string => {
  const absolutePath = path.resolve(BASE_DIR, dirPath);
  if (!fs.existsSync(absolutePath)) {
    fs.mkdirSync(absolutePath, { recursive: true });
  }
  return absolutePath;
};

// Audio format definitions
const audioFormats: AudioFormat[] = [
  {
    extension: 'mp3',
    mimeType: 'audio/mpeg',
    quality: 'high',
    bitrate: 128000  // 128 kbps
  },
  {
    extension: 'wav',
    mimeType: 'audio/wav',
    quality: 'high',
    sampleRate: 44100  // 44.1 kHz
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
  james: 'pNInz6obpgDQGcFmaJgB'
};

// Main configuration object
export const audioConfig: AudioConfig = {
  // Text processing
  maxChunkSize: 4000,
  minChunkSize: 100,
  sentenceSplitRegex: /(?<=[.!?])\s+/,
  
  // File handling
  supportedFormats: audioFormats,
  tempDirectory: ensureDirectory('temp_audio'),
  outputDirectory: ensureDirectory('audio'),
  maxFileSize: 10 * 1024 * 1024, // 10MB
  
  // Voice settings
  defaultVoice: 'rCmVtv8cYU60uhlsOo1M', // Ana's ID directly
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
    // Token bucket for general API protection
    tokensPerInterval: 50,
    interval: 60 * 1000, // 60 seconds in milliseconds
    
    // Concurrency limiting for ElevenLabs API
    maxConcurrent: Number(process.env.ELEVENLABS_MAX_CONCURRENT) || 5, // Default to 5 concurrent requests
    minConcurrent: Number(process.env.ELEVENLABS_MIN_CONCURRENT) || 1, // Never go below 1 concurrent request
    concurrencyWindow: 60 * 1000, // Measure concurrency over 1 minute
    concurrencyBackoff: 0.5, // Reduce concurrency by 50% when hitting limits
    
    // Dynamic throttling configuration
    enableDynamicThrottling: process.env.ENABLE_DYNAMIC_THROTTLING === 'true',
    throttleThreshold: 0.8, // Start throttling at 80% of max concurrency
    throttleStep: 0.2, // Reduce concurrency by 20% when throttling
    throttleRecovery: 0.1, // Increase concurrency by 10% when recovering
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