/**
 * Infrastructure Layer: File Service
 * Manages file operations and text extraction
 */
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
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
    if (!file) return false;
    
    // Check file type (only txt for now)
    const allowedTypes = ['text/plain'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error('Only .txt files are supported at this time');
    }
    
    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('File size exceeds the 5MB limit');
    }
    
    return true;
  }
  
  /**
   * Process an uploaded file and extract its content
   * For Phase 2, we only support .txt files
   */
  processFile(file: any): FileProcessingResult {
    if (!this.validateFile(file)) {
      throw new Error('Invalid file');
    }
    
    try {
      // Extract text from file (currently only supporting .txt)
      const text = file.buffer.toString('utf-8');
      
      return {
        text,
        fileType: 'txt',
        fileName: file.originalname,
        fileSize: file.size
      };
    } catch (error) {
      console.error('Error processing file:', error);
      throw new Error('Failed to process file');
    }
  }
  
  /**
   * Upload file to storage and extract text
   * This implements the "/upload-ebook" edge function functionality
   */
  async uploadAndExtractText(file: any): Promise<TextExtractionResult> {
    try {
      // Process the file to extract text
      const processedFile = this.processFile(file);
      
      // Generate a unique key for storage
      const contentHash = createHash('md5').update(processedFile.text).digest('hex');
      const fileKey = `uploads/${contentHash}_${file.originalname}`;
      
      // Store the file in the simulated S3 storage
      const storedFile = await storageService.storeFile(
        file.buffer,
        fileKey,
        file.originalname,
        file.mimetype
      );
      
      // Update analytics
      await this.updateFileAnalytics('txt', processedFile.text.length);
      
      return {
        text: processedFile.text,
        fileInfo: storedFile,
        charCount: processedFile.text.length,
        fileType: 'txt'
      };
    } catch (error) {
      console.error('Error in uploadAndExtractText:', error);
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
      const fileTypesData = analytics.fileTypes as Record<string, number>;
      const fileTypes = { ...fileTypesData };
      fileTypes[fileType] = (fileTypes[fileType] || 0) + 1;
      
      // Safely get the current values
      const fileUploads = analytics.fileUploads || 0;
      const characterCount = analytics.characterCount || 0;
      
      await storage.updateAnalytics({
        fileUploads: fileUploads + 1,
        characterCount: characterCount + charCount,
        fileTypes
      });
    }
  }
}

export const fileService = new FileService();