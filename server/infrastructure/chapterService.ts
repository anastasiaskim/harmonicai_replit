/**
 * Chapter Service
 * 
 * This service provides functionality for chapter detection, both using
 * traditional pattern matching and AI-powered detection.
 */

import { convertAIDetectionToChapters, chunkByChapter } from '../../client/src/lib/chapterDetection';
import { log } from '../vite';
import { aiService } from './aiService';
import { Chapter } from '../../shared/schema';

export interface ChunkingResult {
  chapters: Chapter[];
  wasChunked: boolean;
  originalText: string;
  patternMatchCounts: Record<string, number>;
  aiDetection?: boolean;
  confidenceLevels?: Record<string, number>;
}

/**
 * Chapter Service for detecting and managing chapters in text content
 */
export class ChapterService {
  /**
   * Detect chapters in text content using AI if available, with fallback to pattern matching
   * 
   * @param text The text to analyze for chapter detection
   * @returns A ChunkingResult with detected chapters and metadata
   */
  async detectChapters(text: string): Promise<ChunkingResult> {
    log('Starting chapter detection process', 'chapterService');
    
    try {
      // First try AI detection if API key is available
      const hasAiKey = await aiService.hasValidApiKey();
      
      if (hasAiKey) {
        log('Using AI-powered chapter detection', 'chapterService');
        const aiDetectedChapters = await aiService.detectChapters(text);
        
        if (aiDetectedChapters && aiDetectedChapters.length > 0) {
          log(`AI detected ${aiDetectedChapters.length} potential chapters`, 'chapterService');
          
          // Convert AI detection results to our chapter format
          const chunkingResult = convertAIDetectionToChapters(aiDetectedChapters, text);
          
          // If AI found sufficient chapters, return them
          if (chunkingResult.wasChunked) {
            return chunkingResult;
          } else {
            log('AI detection found insufficient chapters, falling back to pattern matching', 'chapterService');
          }
        } else {
          log('AI detection returned no results, falling back to pattern matching', 'chapterService');
        }
      }
      
      // Fall back to pattern matching if AI wasn't available or didn't find chapters
      log('Using pattern-based chapter detection', 'chapterService');
      const patternResult = chunkByChapter(text);
      
      return patternResult;
    } catch (error) {
      log(`Error in chapter detection: ${error}`, 'chapterService');
      
      // Return a basic chunking with just one chapter on error
      return {
        chapters: [{
          title: 'Chapter 1',
          text: text
        }],
        wasChunked: false,
        originalText: text,
        patternMatchCounts: {}
      };
    }
  }
  
  /**
   * Split text into chapters at specified positions
   * 
   * @param text The original text content
   * @param chapterPositions Array of positions where chapters start
   * @returns Array of chapters
   */
  splitTextIntoChapters(text: string, chapterPositions: {title: string, position: number}[]): Chapter[] {
    if (!chapterPositions || chapterPositions.length === 0) {
      return [{
        title: 'Chapter 1',
        text: text
      }];
    }
    
    // Sort positions in ascending order
    const sortedPositions = [...chapterPositions].sort((a, b) => a.position - b.position);
    
    const chapters: Chapter[] = [];
    
    // Process each chapter
    for (let i = 0; i < sortedPositions.length; i++) {
      const start = sortedPositions[i].position;
      const end = i < sortedPositions.length - 1 ? sortedPositions[i + 1].position : text.length;
      
      chapters.push({
        title: sortedPositions[i].title,
        text: text.substring(start, end).trim()
      });
    }
    
    return chapters;
  }
}

// Export a singleton instance for general use
export const chapterService = new ChapterService();