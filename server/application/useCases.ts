/**
 * Application Layer: Use Cases
 * Contains the business logic for the application
 */

import { storage } from '../storage';
import { aiService } from '../infrastructure/aiService';
import type { ChapterDetectionResult } from '../infrastructure/aiService';
import { ChunkingResult } from '../../client/src/lib/chapterDetection';
import { convertAIDetectionToChapters } from '../../client/src/lib/chapterDetection';
import type { Voice } from '@shared/schema';
import type { TextToSpeechRequest } from '@shared/schema';
import type { Request, Response } from 'express';
import multer from 'multer';

/**
 * UseCase for detecting chapters in text using AI
 */
export class ChapterDetectionUseCase {
  /**
   * Detect chapters in text using AI and then fallback to regex patterns if AI fails
   * 
   * @param text The text content to analyze
   * @param userId The user ID (to retrieve their API key)
   * @returns A ChunkingResult with AI-detected chapters or regex-detected chapters
   */
  async detectChapters(text: string, userId: string): Promise<ChunkingResult> {
    try {
      // First, try to get the user's Google AI API key
      const apiKey = await storage.getApiKeyByUserAndService(userId, 'google-ai');
      
      if (!apiKey || !apiKey.apiKey) {
        console.log('No Google AI API key found for user, falling back to regex detection');
        // No API key, so use traditional chunking
        const chunkingResult = await this.fallbackToRegexDetection(text);
        return {
          ...chunkingResult,
          aiDetection: false
        };
      }
      
      console.log('Found Google AI API key, attempting AI-powered chapter detection');
      
      // Track the AI detection usage in analytics
      await storage.updateAnalytics({ aiDetections: 1 });
      
      // Use the AI service to detect chapters
      const aiResult: ChapterDetectionResult = await aiService.detectChapters(text, apiKey.apiKey);
      
      if (!aiResult.success || aiResult.chapters.length < 2) {
        console.log('AI detection failed or found too few chapters, falling back to regex detection');
        // AI detection failed, so use traditional chunking
        const chunkingResult = await this.fallbackToRegexDetection(text);
        return {
          ...chunkingResult,
          aiDetection: true
        };
      }
      
      // Convert the AI detection result to our ChunkingResult format
      return convertAIDetectionToChapters(aiResult.chapters, text);
    } catch (error) {
      console.error('Error in AI chapter detection use case:', error);
      
      // On error, fall back to regex detection
      const chunkingResult = await this.fallbackToRegexDetection(text);
      return {
        ...chunkingResult,
        aiDetection: false
      };
    }
  }
  
  /**
   * Fallback to regex-based chapter detection
   * 
   * @param text The text content to analyze
   * @returns A ChunkingResult with regex-detected chapters
   */
  private async fallbackToRegexDetection(text: string): Promise<ChunkingResult> {
    // Import the chunkByChapter function dynamically to avoid circular dependencies
    const { chunkByChapter } = await import('../../client/src/lib/chapterDetection');
    return chunkByChapter(text);
  }
}

export const chapterDetectionUseCase = new ChapterDetectionUseCase();

/**
 * Get all available voices
 */
export async function getVoicesUseCase(): Promise<Voice[]> {
  return storage.getVoices();
}

/**
 * Process text from a file or direct input
 */
export async function processTextUseCase(params: {
  file?: Express.Multer.File;
  directText?: string;
}): Promise<{ text: string; wasChunked: boolean; chapters?: any[] }> {
  // This is a stub - in a real implementation, we would process the file
  // and extract text content using appropriate libraries
  let text = '';
  
  if (params.file) {
    // For MVP, assume the file contains plain text
    text = params.file.buffer.toString('utf-8');
    
    // Update analytics
    await storage.updateAnalytics({ 
      fileUploads: 1,
      characterCount: text.length
    });
  } else if (params.directText) {
    text = params.directText;
    
    // Update analytics
    await storage.updateAnalytics({ 
      textInputs: 1,
      characterCount: text.length
    });
  }
  
  return {
    text,
    wasChunked: false
  };
}

/**
 * Generate audiobook from text content
 */
export async function generateAudiobookUseCase(data: TextToSpeechRequest): Promise<any[]> {
  // This is a stub - in a real implementation, we would convert text to speech
  // using ElevenLabs or another TTS service
  
  // Update analytics
  await storage.updateAnalytics({ 
    conversions: 1
  });
  
  return data.chapters.map((chapter, index) => ({
    id: index,
    title: chapter.title,
    audioUrl: `/audio/demo-${index}.mp3`,
    duration: Math.floor(chapter.text.length / 20) // Rough estimate
  }));
}

/**
 * Get analytics data
 */
export async function getAnalyticsUseCase() {
  return storage.getAnalytics();
}