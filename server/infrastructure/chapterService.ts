/**
 * Chapter Service
 * 
 * This service handles chapter detection and processing based on text input.
 * It provides both simple pattern-based detection and calls to AI services
 * for more advanced capabilities.
 */

import { aiService } from "./aiService";
import { storage } from "../storage";
import { InsertChapter } from "../../shared/schema";

// Interface for a detected chapter with content and metadata
interface DetectedChapter {
  title: string;
  text: string;
  confidence?: number;
}

// Result from chapter detection process
export interface ChapterDetectionResult {
  chapters: DetectedChapter[];
  wasChunked: boolean;
  aiDetection: boolean;
  confidenceLevels?: Record<string, number>;
}

/**
 * Service for chapter detection and management
 */
export class ChapterService {
  /**
   * Detects chapters in text content with optional AI assistance
   * 
   * @param text The text content to analyze
   * @param useAI Whether to use AI for chapter detection
   * @returns Detection result with chapters and metadata
   */
  async detectChapters(text: string, useAI: boolean = true): Promise<ChapterDetectionResult> {
    // Initialize result
    const result: ChapterDetectionResult = {
      chapters: [],
      wasChunked: false,
      aiDetection: false,
      confidenceLevels: {}
    };
    
    if (!text || text.trim().length === 0) {
      // Return empty result for empty text
      return result;
    }
    
    try {
      if (useAI) {
        // Try AI-powered chapter detection
        return await this.detectChaptersWithAI(text);
      } else {
        // Fallback to pattern-based detection
        return await this.detectChaptersWithPatterns(text);
      }
    } catch (error) {
      console.error("Error detecting chapters:", error);
      
      // Fallback to basic detection on error
      return this.createSingleChapter(text);
    }
  }
  
  /**
   * Detects chapters using AI-powered analysis
   * 
   * @param text The text content to analyze
   * @returns Detection result using AI
   */
  private async detectChaptersWithAI(text: string): Promise<ChapterDetectionResult> {
    try {
      // Call AI service for chapter detection
      const aiResult = await aiService.detectChapters(text);
      
      if (!aiResult.chapters || aiResult.chapters.length === 0) {
        // No chapters detected by AI, fall back to pattern detection
        return await this.detectChaptersWithPatterns(text);
      }
      
      // Process AI-detected chapters
      const chapters: DetectedChapter[] = [];
      const confidenceLevels: Record<string, number> = {};
      
      // Sort chapters by start index (already done in AI service but double-check)
      const sortedChapters = [...aiResult.chapters].sort((a, b) => a.startIndex - b.startIndex);
      
      for (let i = 0; i < sortedChapters.length; i++) {
        const chapter = sortedChapters[i];
        const startIndex = chapter.startIndex;
        const endIndex = chapter.endIndex || text.length;
        
        // Extract chapter text
        const chapterText = text.substring(startIndex, endIndex).trim();
        
        if (chapterText.length > 0) {
          // Create chapter and store confidence
          chapters.push({
            title: chapter.title,
            text: chapterText,
            confidence: chapter.confidence
          });
          
          // Store confidence level for UI display
          confidenceLevels[chapter.title] = chapter.confidence;
        }
      }
      
      return {
        chapters,
        wasChunked: chapters.length > 1,
        aiDetection: true,
        confidenceLevels
      };
    } catch (error) {
      console.error("Error in AI chapter detection:", error);
      
      // Fall back to pattern-based detection
      return await this.detectChaptersWithPatterns(text);
    }
  }
  
  /**
   * Detects chapters using pattern matching for common chapter formats
   * 
   * @param text The text content to analyze
   * @returns Detection result using pattern matching
   */
  private async detectChaptersWithPatterns(text: string): Promise<ChapterDetectionResult> {
    const chapters: DetectedChapter[] = [];
    const confidenceLevels: Record<string, number> = {};
    
    // Common patterns for chapter headings
    const patterns = [
      /\n\s*chapter\s+(\d+|[ivxlcdm]+)(?:\s*[:.-]\s*(.+?))?(?=\n)/gi,
      /^\s*chapter\s+(\d+|[ivxlcdm]+)(?:\s*[:.-]\s*(.+?))?(?=\n)/gi,
      /\n\s*part\s+(\d+|[ivxlcdm]+)(?:\s*[:.-]\s*(.+?))?(?=\n)/gi,
      /\n\s*section\s+(\d+|[ivxlcdm]+)(?:\s*[:.-]\s*(.+?))?(?=\n)/gi
    ];
    
    // Find all chapter markers
    const markers: { index: number; title: string }[] = [];
    
    for (const pattern of patterns) {
      let match;
      pattern.lastIndex = 0; // Reset regex state
      
      while ((match = pattern.exec(text)) !== null) {
        const chapterNum = match[1];
        const chapterTitle = match[2] ? match[2].trim() : `Chapter ${chapterNum}`;
        
        markers.push({
          index: match.index,
          title: chapterTitle
        });
      }
    }
    
    // Sort markers by position in text
    markers.sort((a, b) => a.index - b.index);
    
    // Create chapters from markers
    if (markers.length > 0) {
      for (let i = 0; i < markers.length; i++) {
        const startIndex = markers[i].index;
        const endIndex = i < markers.length - 1 ? markers[i + 1].index : text.length;
        
        // Extract chapter text
        const chapterText = text.substring(startIndex, endIndex).trim();
        
        if (chapterText.length > 0) {
          const title = markers[i].title;
          
          // Create chapter with medium confidence
          const confidence = 0.6;
          
          chapters.push({
            title,
            text: chapterText,
            confidence
          });
          
          confidenceLevels[title] = confidence;
        }
      }
    }
    
    // If no chapters found, create single chapter
    if (chapters.length === 0) {
      return this.createSingleChapter(text);
    }
    
    return {
      chapters,
      wasChunked: chapters.length > 1,
      aiDetection: false,
      confidenceLevels
    };
  }
  
  /**
   * Creates a single chapter from the entire text
   * 
   * @param text The text content to use
   * @returns Detection result with a single chapter
   */
  private createSingleChapter(text: string): ChapterDetectionResult {
    return {
      chapters: [{
        title: "Chapter 1",
        text: text.trim()
      }],
      wasChunked: false,
      aiDetection: false
    };
  }
  
  /**
   * Stores detected chapters in the database
   * 
   * @param chapters The chapters to store
   * @returns Stored chapter entities
   */
  async saveChapters(chapters: DetectedChapter[]): Promise<InsertChapter[]> {
    const savedChapters: InsertChapter[] = [];
    
    for (const chapter of chapters) {
      const chapterData: InsertChapter = {
        title: chapter.title,
        audioUrl: "", // Will be populated later when audio is generated
        duration: 0,  // Will be updated when audio is generated
        size: 0,      // Will be updated when audio is generated
        createdAt: new Date().toISOString()
      };
      
      savedChapters.push(chapterData);
    }
    
    return savedChapters;
  }
}

export const chapterService = new ChapterService();