/**
 * Infrastructure Layer: Chapter Service
 * Handles chapter detection and processing
 */

import { storage } from '../storage';
import { ChunkingResult, detectChapters } from '../../client/src/lib/chapterDetection';

export class ChapterService {
  /**
   * Detect chapters in text content
   * 
   * @param text The text content to analyze
   * @returns An array of chapters
   */
  detectChapters(text: string) {
    return detectChapters(text);
  }
  
  /**
   * Detect chapters with detailed information
   * 
   * @param text The text content to analyze
   * @returns A ChunkingResult with detailed information
   */
  detectChaptersDetailed(text: string): ChunkingResult {
    // Import chunkByChapter dynamically to avoid circular dependencies
    const { chunkByChapter } = require('../../client/src/lib/chapterDetection');
    return chunkByChapter(text);
  }
}

export const chapterService = new ChapterService();