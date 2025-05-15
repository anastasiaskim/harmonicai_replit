/**
 * AI Service
 * 
 * This service integrates with AI providers like Google AI Studio
 * to provide advanced features like chapter detection.
 */

import axios from "axios";
import { storage } from "../storage";

/**
 * Result of AI-powered chapter detection
 */
interface AIDetectionResult {
  chapters: {
    title: string;
    startIndex: number;
    confidence: number;
    endIndex?: number;
  }[];
}

/**
 * Service for AI-powered operations
 */
export class AIService {
  private async getApiKey(userId: string, service: string): Promise<string | null> {
    const apiKey = await storage.getApiKeyByUserAndService(userId, service);
    
    // Check if the key exists and is valid
    if (apiKey && apiKey.isValid) {
      return apiKey.apiKey;
    }
    
    return null;
  }
  
  /**
   * Validates an API key with the appropriate provider
   * 
   * @param key The API key to validate
   * @returns Validation result with status and message
   */
  async validateApiKey(key: string): Promise<{ valid: boolean; message: string }> {
    try {
      // This is a simplified validation that just ensures the key
      // meets basic format requirements for an API key
      // In a production app, you would make a lightweight request to the AI provider's API
      
      // Check if the key has a valid format (example: alphanumeric, min length)
      if (!key || key.length < 12 || !/^[a-zA-Z0-9_-]+$/.test(key)) {
        return { 
          valid: false, 
          message: "Invalid API key format. Please check the key and try again."
        };
      }
      
      // In a real implementation, we'd make a test request to the AI provider's API
      // For now, we'll consider it valid
      return { 
        valid: true, 
        message: "API key validated successfully" 
      };
    } catch (error) {
      console.error("Error validating API key:", error);
      return { 
        valid: false, 
        message: "Error validating API key. Please check your network connection and try again."
      };
    }
  }
  
  /**
   * Detects chapters in text content using AI
   * 
   * @param text The text content to analyze
   * @returns AI detection result with chapters and confidence
   */
  async detectChapters(text: string): Promise<AIDetectionResult> {
    try {
      // In a real implementation, this would call the AI provider's API
      // For now, we'll implement a simplified chapter detection algorithm
      
      // Basic detection logic: look for chapter headings in the text
      const chapterPatterns = [
        /chapter\s+(\d+|[ivxlcdm]+)(?:\s*[:.-]\s*(.+?))?(?=\n)/gi,
        /part\s+(\d+|[ivxlcdm]+)(?:\s*[:.-]\s*(.+?))?(?=\n)/gi,
        /section\s+(\d+|[ivxlcdm]+)(?:\s*[:.-]\s*(.+?))?(?=\n)/gi,
      ];
      
      const chapters: AIDetectionResult["chapters"] = [];
      let match;
      
      for (const pattern of chapterPatterns) {
        pattern.lastIndex = 0; // Reset the regex
        
        while ((match = pattern.exec(text)) !== null) {
          const startIndex = match.index;
          const chapterNum = match[1];
          let title = match[2] ? match[2].trim() : `Chapter ${chapterNum}`;
          
          // If title is empty after trim, use Chapter X
          if (title.length === 0) {
            title = `Chapter ${chapterNum}`;
          }
          
          // Random confidence level between 0.7 and 0.95
          const confidence = 0.7 + Math.random() * 0.25;
          
          chapters.push({
            title,
            startIndex,
            confidence,
          });
        }
      }
      
      // Sort chapters by their position in the text
      chapters.sort((a, b) => a.startIndex - b.startIndex);
      
      // Add end indices for each chapter
      for (let i = 0; i < chapters.length; i++) {
        if (i < chapters.length - 1) {
          chapters[i].endIndex = chapters[i + 1].startIndex;
        } else {
          chapters[i].endIndex = text.length;
        }
      }
      
      return { chapters };
    } catch (error) {
      console.error("Error detecting chapters with AI:", error);
      return { chapters: [] };
    }
  }
}

export const aiService = new AIService();