/**
 * Application Use Cases
 * 
 * This file contains the business logic and use cases for the application
 * following the clean architecture pattern. It coordinates between
 * infrastructure services and API routes.
 */

import { z } from 'zod';
import { chapterService, ChunkingResult } from '../infrastructure/chapterService';
import { aiService } from '../infrastructure/aiService';
import { storage } from '../storage';
import { log } from '../vite';

/**
 * Schema for the AI API key validation request
 */
export const apiKeySchema = z.object({
  service: z.string(),
  key: z.string().min(1)
});

/**
 * Schema for the chapter detection request
 */
export const chapterDetectionSchema = z.object({
  text: z.string().min(1),
  useAI: z.boolean().optional().default(true)
});

/**
 * Use case for validating and storing API keys
 */
export class ApiKeyUseCase {
  /**
   * Set and validate an API key
   * 
   * @param service The service identifier (e.g., 'google_ai')
   * @param key The API key to validate and store
   * @returns Success status and message
   */
  async setApiKey(service: string, key: string): Promise<{ success: boolean; message: string }> {
    try {
      // Currently only supporting Google AI service
      if (service === 'google_ai') {
        const result = await aiService.setApiKey(key);
        
        if (result) {
          return {
            success: true,
            message: 'Google AI API key validated and stored successfully'
          };
        } else {
          return {
            success: false,
            message: 'Failed to validate or store Google AI API key'
          };
        }
      }
      
      return {
        success: false,
        message: `Unsupported service: ${service}`
      };
    } catch (error) {
      log(`Error in ApiKeyUseCase.setApiKey: ${error}`, 'application');
      return {
        success: false,
        message: `An error occurred: ${error}`
      };
    }
  }
}

/**
 * Use case for chapter detection in text
 */
export class ChapterDetectionUseCase {
  /**
   * Detect chapters in text content with AI assistance if available
   * 
   * @param text The text content to analyze
   * @param useAI Whether to attempt AI-powered detection
   * @returns Chunking result with chapters and metadata
   */
  async detectChapters(text: string, useAI: boolean = true): Promise<ChunkingResult> {
    try {
      // Check if we should try AI detection
      if (useAI) {
        // Use the service to detect chapters
        return await chapterService.detectChapters(text);
      } else {
        // Skip AI detection and use only pattern matching
        log('Skipping AI detection as requested', 'application');
        return chapterService.detectChapters(text);
      }
    } catch (error) {
      log(`Error in ChapterDetectionUseCase.detectChapters: ${error}`, 'application');
      
      // Return a fallback single chapter on error
      return {
        chapters: [{
          title: 'Chapter 1',
          text: text
        }],
        wasChunked: false,
        originalText: text,
        patternMatchCounts: {},
        aiDetection: false
      };
    }
  }
}

// Export singleton instances
export const apiKeyUseCase = new ApiKeyUseCase();
export const chapterDetectionUseCase = new ChapterDetectionUseCase();