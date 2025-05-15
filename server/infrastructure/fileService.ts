/**
 * Infrastructure Layer: File Service
 * Manages file operations and text extraction
 */
import * as fs from 'fs';
import * as path from 'path';
import { storage } from '../storage';
import { storageService, StoredFile } from './storageService';

export interface FileProcessingResult {
  text: string;
  fileType: string;
  fileKey?: string;
  fileName?: string;
  fileSize?: number;
  fileUrl?: string;
}

export interface TextExtractionResult {
  text: string;
  fileInfo: StoredFile;
  charCount: number;
  fileType: string;
}

class FileService {
  /**
   * Validate file type and size
   * For Phase 2, we only support .txt files
   */
  validateFile(file: any): boolean {
    const { originalname, buffer, mimetype, size } = file;
    
    // Validate mimetype and extension
    const isValidType = mimetype === "text/plain" || 
                        originalname.toLowerCase().endsWith(".txt");
    
    if (!isValidType) {
      throw new Error("Invalid file type. Only TXT files are supported.");
    }
    
    // Validate file size (5MB limit)
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (size > MAX_SIZE) {
      throw new Error(`File too large. Maximum file size is 5MB.`);
    }
    
    return true;
  }

  /**
   * Process an uploaded file and extract its content
   * For Phase 2, we only support .txt files
   */
  processFile(file: any): FileProcessingResult {
    const { originalname, buffer, mimetype } = file;
    
    // Validate the file
    this.validateFile(file);
    
    // Extract text content from the file
    const text = buffer.toString("utf-8");
    const fileType = "txt";
    
    return { text, fileType };
  }
  
  /**
   * Upload file to storage and extract text
   * This implements the "/upload-ebook" edge function functionality
   */
  async uploadAndExtractText(file: any): Promise<TextExtractionResult> {
    try {
      // Validate and process file
      this.validateFile(file);
      
      // Extract basic text content
      const { text, fileType } = this.processFile(file);
      
      // Store the file
      const storedFile = await storageService.storeFile(
        file.buffer,
        file.originalname,
        file.mimetype
      );
      
      // Update analytics
      await this.updateFileAnalytics(fileType, text.length);
      
      // Return extracted text and file metadata
      return {
        text,
        fileInfo: storedFile,
        charCount: text.length,
        fileType
      };
    } catch (error) {
      console.error('Error uploading and extracting text:', error);
      throw error;
    }
  }
  
  /**
   * Update file-related analytics
   */
  async updateFileAnalytics(fileType: string, charCount: number): Promise<void> {
    const analytics = await storage.getAnalytics();
    if (analytics) {
      // Create a safe copy of file types
      const fileTypes = analytics.fileTypes as Record<string, number>;
      const updatedFileTypes = { ...fileTypes };
      updatedFileTypes[fileType] = (updatedFileTypes[fileType] || 0) + 1;
      
      // Safely get the current character count
      const totalChars = analytics.totalCharacters || 0;
      
      await storage.updateAnalytics({
        totalCharacters: totalChars + charCount,
        fileTypes: updatedFileTypes
      });
    }
  }
}

export const fileService = new FileService();