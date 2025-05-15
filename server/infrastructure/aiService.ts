/**
 * AI Service
 * 
 * This service interacts with Google AI Gemini API to perform AI-based text analysis
 * for chapter detection and other NLP tasks.
 */

import axios from 'axios';
import { z } from 'zod';
import { ApiKey } from '../../shared/schema';
import { storage } from '../storage';
import { log } from '../vite';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1';
const DEFAULT_MODEL = 'gemini-1.5-flash';
const MAX_CHUNK_SIZE = 5000; // Maximum characters per chunk to avoid API limits

// Schema for the detected chapter from AI
export const AIDetectedChapterSchema = z.object({
  title: z.string(),
  startIndex: z.number(),
  endIndex: z.number().optional(),
  confidence: z.number().min(0).max(1) // Confidence score between 0 and 1
});

export type AIDetectedChapter = z.infer<typeof AIDetectedChapterSchema>;

/**
 * AI Service class for handling interactions with AI APIs
 */
export class AIService {
  private cachedApiKey: string | null = null;
  private userId: string;
  
  constructor(userId: string = 'system') {
    this.userId = userId;
  }
  
  /**
   * Get the Google AI API key for the current user
   */
  async getApiKey(): Promise<string | null> {
    // If we have a cached key, use it
    if (this.cachedApiKey) {
      return this.cachedApiKey;
    }
    
    try {
      // Get the API key from storage
      const apiKey = await storage.getApiKeyByUserAndService(this.userId, 'google_ai');
      
      if (apiKey && apiKey.key) {
        this.cachedApiKey = apiKey.key;
        return apiKey.key;
      }
      
      return null;
    } catch (error) {
      log(`Error retrieving Google AI API key: ${error}`, 'aiService');
      return null;
    }
  }
  
  /**
   * Check if the AI service has a valid API key
   */
  async hasValidApiKey(): Promise<boolean> {
    const apiKey = await this.getApiKey();
    return apiKey !== null && apiKey.length > 0;
  }
  
  /**
   * Set the Google AI API key for the current user
   */
  async setApiKey(key: string): Promise<ApiKey | null> {
    try {
      // First validate the key with a simple request
      const isValid = await this.testApiKey(key);
      
      if (!isValid) {
        log('Invalid Google AI API key', 'aiService');
        return null;
      }
      
      // Check if a key already exists for this user and service
      const existingKey = await storage.getApiKeyByUserAndService(this.userId, 'google_ai');
      
      if (existingKey) {
        // Update the existing key
        const updatedKey = await storage.updateApiKey(existingKey.id, {
          key,
          updatedAt: new Date()
        });
        
        if (updatedKey) {
          this.cachedApiKey = key;
          return updatedKey;
        }
      } else {
        // Create a new key
        const newKey = await storage.insertApiKey({
          userId: this.userId,
          service: 'google_ai',
          key,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        this.cachedApiKey = key;
        return newKey;
      }
      
      return null;
    } catch (error) {
      log(`Error setting Google AI API key: ${error}`, 'aiService');
      return null;
    }
  }
  
  /**
   * Test if a Google AI API key is valid
   */
  async testApiKey(key: string): Promise<boolean> {
    try {
      // Make a simple request to the Google AI API to validate the key
      const response = await axios.get(
        `${GEMINI_API_URL}/models?key=${key}`
      );
      
      return response.status === 200;
    } catch (error) {
      log(`API key validation failed: ${error}`, 'aiService');
      return false;
    }
  }
  
  /**
   * Detect chapters in text using AI
   * 
   * @param text The text to analyze for chapter detection
   * @returns Array of detected chapters with positions and confidence scores
   */
  async detectChapters(text: string): Promise<AIDetectedChapter[]> {
    const apiKey = await this.getApiKey();
    
    if (!apiKey) {
      log('No Google AI API key found', 'aiService');
      return [];
    }
    
    try {
      // Split long text into manageable chunks to avoid API limits
      const chunks = this.chunkText(text);
      const allDetectedChapters: AIDetectedChapter[] = [];
      let offsetIndex = 0;
      
      // Process each chunk separately
      for (const chunk of chunks) {
        const prompt = `
        Analyze this text and identify chapter headings or section breaks. For each detected chapter:
        1. Extract the exact chapter title as it appears in the text
        2. Determine the character position (index) where the chapter title starts
        3. Assign a confidence score between 0 and 1 indicating how certain you are that this is a chapter heading
        
        Return the results in JSON format only, as an array of objects with these properties:
        - title: the exact chapter heading text
        - startIndex: the character position where the chapter title begins
        - confidence: a number between 0-1 indicating confidence level
        
        Text to analyze:
        ${chunk}
        `;
        
        const response = await axios.post(
          `${GEMINI_API_URL}/models/${DEFAULT_MODEL}:generateContent?key=${apiKey}`,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              topP: 0.95,
              topK: 40,
              maxOutputTokens: 2048,
              responseMimeType: "application/json"
            }
          }
        );
        
        if (response.data?.candidates && response.data.candidates.length > 0) {
          const responseText = response.data.candidates[0]?.content?.parts[0]?.text || '';
          
          // Extract the JSON from the response
          const jsonMatch = responseText.match(/(\[.*\])/s);
          
          if (jsonMatch && jsonMatch[1]) {
            try {
              const chapterData = JSON.parse(jsonMatch[1]);
              
              // Validate the chapter data and adjust indices based on chunk offset
              const validatedChapters = chapterData
                .map((chapter: any) => {
                  try {
                    // Validate using our schema
                    const result = AIDetectedChapterSchema.parse({
                      title: chapter.title,
                      startIndex: chapter.startIndex + offsetIndex,
                      confidence: chapter.confidence
                    });
                    
                    return result;
                  } catch (validationError) {
                    log(`Invalid chapter data: ${JSON.stringify(chapter)}`, 'aiService');
                    return null;
                  }
                })
                .filter(Boolean);
              
              allDetectedChapters.push(...validatedChapters);
            } catch (parseError) {
              log(`Failed to parse AI response: ${parseError}`, 'aiService');
            }
          }
        }
        
        // Update the offset for the next chunk
        offsetIndex += chunk.length;
      }
      
      // Sort chapters by start position and return
      return allDetectedChapters.sort((a, b) => a.startIndex - b.startIndex);
    } catch (error) {
      log(`Error detecting chapters with AI: ${error}`, 'aiService');
      return [];
    }
  }
  
  /**
   * Splits text into manageable chunks for API processing
   * 
   * @param text The text to chunk
   * @returns Array of text chunks
   */
  private chunkText(text: string): string[] {
    if (text.length <= MAX_CHUNK_SIZE) {
      return [text];
    }
    
    const chunks: string[] = [];
    let startIndex = 0;
    
    while (startIndex < text.length) {
      // Find a good breaking point near the MAX_CHUNK_SIZE boundary
      let endIndex = Math.min(startIndex + MAX_CHUNK_SIZE, text.length);
      
      // Try to break at a paragraph or sentence boundary if possible
      if (endIndex < text.length) {
        // Look for paragraph break
        const paragraphBreak = text.lastIndexOf('\n\n', endIndex);
        if (paragraphBreak > startIndex && paragraphBreak > endIndex - 500) {
          endIndex = paragraphBreak;
        } else {
          // Look for newline
          const newlineBreak = text.lastIndexOf('\n', endIndex);
          if (newlineBreak > startIndex && newlineBreak > endIndex - 500) {
            endIndex = newlineBreak;
          } else {
            // Look for sentence boundary
            const sentenceBreak = text.lastIndexOf('. ', endIndex);
            if (sentenceBreak > startIndex && sentenceBreak > endIndex - 500) {
              endIndex = sentenceBreak + 1; // Include the period
            }
          }
        }
      }
      
      chunks.push(text.substring(startIndex, endIndex));
      startIndex = endIndex;
    }
    
    return chunks;
  }
}

// Export a singleton instance for general use
export const aiService = new AIService();