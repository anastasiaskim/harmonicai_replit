/**
 * Application Use Cases
 * 
 * This file contains the business logic and use cases for the application
 * following the clean architecture pattern. It coordinates between
 * infrastructure services and API routes.
 */

import { storage } from "../storage";
import { aiService } from "../infrastructure/aiService";
import { chapterService, ChapterDetectionResult } from "../infrastructure/chapterService";
import { z } from "zod";

/**
 * Schema for the API key validation request
 */
export const apiKeySchema = z.object({
  service: z.string().min(1),
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
      // Simple user ID since we don't have user auth yet
      const userId = "default-user";
      
      // Check if the user already has a key for this service
      const existingKey = await storage.getApiKeyByUserAndService(userId, service);
      
      // Validate the key with the appropriate service
      const { valid: isValid, message } = await aiService.validateApiKey(key);
      
      if (isValid) {
        // Store or update the key
        if (existingKey) {
          await storage.updateApiKey(existingKey.id, { 
            apiKey: key,
            isValid: true,
            lastValidated: new Date().toISOString() 
          });
        } else {
          await storage.insertApiKey({ 
            userId, 
            service, 
            apiKey: key,
            isValid: true,
            lastValidated: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
        
        return { 
          success: true, 
          message: `${service} API key has been validated and saved`
        };
      } else {
        // Still store the key, but mark as invalid
        if (existingKey) {
          await storage.updateApiKey(existingKey.id, { 
            apiKey: key,
            isValid: false,
            lastValidated: new Date().toISOString(),
          });
        } else {
          await storage.insertApiKey({ 
            userId, 
            service, 
            apiKey: key,
            isValid: false,
            lastValidated: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
        
        return { 
          success: false, 
          message: message || "API key validation failed"
        };
      }
    } catch (error) {
      console.error("Error setting API key:", error);
      return { 
        success: false, 
        message: "An error occurred while processing your API key"
      };
    }
  }
  
  /**
   * Check if a valid API key exists for a service
   * 
   * @param service The service to check
   * @returns Whether a valid key exists
   */
  async hasValidKey(service: string): Promise<boolean> {
    try {
      const userId = "default-user";
      const key = await storage.getApiKeyByUserAndService(userId, service);
      
      return !!key && key.isValid === true;
    } catch (error) {
      console.error("Error checking for valid API key:", error);
      return false;
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
  async detectChapters(text: string, useAI: boolean = true): Promise<ChapterDetectionResult> {
    try {
      // Check if we should try AI detection
      let canUseAI = useAI;
      
      if (useAI) {
        // Verify if we have a valid API key for AI services
        const apiKeyUseCase = new ApiKeyUseCase();
        canUseAI = await apiKeyUseCase.hasValidKey("google_ai");
        
        // If no valid key, we'll fall back to pattern-based detection
        if (!canUseAI) {
          console.log("No valid AI API key found, using pattern-based detection");
        }
      }
      
      // Perform chapter detection
      return await chapterService.detectChapters(text, canUseAI);
    } catch (error) {
      console.error("Error in chapter detection use case:", error);
      
      // Return a basic single chapter on error
      return {
        chapters: [{
          title: "Chapter 1",
          text: text.trim()
        }],
        wasChunked: false,
        aiDetection: false
      };
    }
  }
}

// Export use case instances for global use
export const apiKeyUseCase = new ApiKeyUseCase();
export const chapterDetectionUseCase = new ChapterDetectionUseCase();