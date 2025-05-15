/**
 * Infrastructure Layer: File Service
 * Manages file operations and text extraction
 */
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { storage } from '../storage';
import { storageService, StoredFile } from './storageService';
// Import the libraries properly
import EPub from 'epub';
import pdfParse from 'pdf-parse';

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
   * Support for txt, epub, and pdf files
   */
  validateFile(file: any): boolean {
    if (!file) return false;
    
    // Check file type
    const allowedTypes = [
      'text/plain',
      'application/epub+zip',
      'application/pdf'
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error('Only .txt, .epub, and .pdf files are supported');
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
   * Supports txt, epub, and pdf files
   */
  async processFile(file: any): Promise<FileProcessingResult> {
    if (!this.validateFile(file)) {
      throw new Error('Invalid file');
    }
    
    try {
      let text = '';
      let fileType = '';
      
      // Process based on file type
      if (file.mimetype === 'text/plain') {
        // Handle TXT files
        text = file.buffer.toString('utf-8');
        fileType = 'txt';
      } 
      else if (file.mimetype === 'application/epub+zip') {
        // Handle EPUB files
        text = await this.extractTextFromEpub(file.buffer);
        fileType = 'epub';
      } 
      else if (file.mimetype === 'application/pdf') {
        // Handle PDF files
        text = await this.extractTextFromPdf(file.buffer);
        fileType = 'pdf';
      }
      
      return {
        text,
        fileType,
        fileName: file.originalname,
        fileSize: file.size
      };
    } catch (error) {
      console.error('Error processing file:', error);
      throw new Error(`Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Extract text from EPUB file
   */
  private extractTextFromEpub(buffer: Buffer): Promise<string> {
    return new Promise((resolve) => {
      try {
        // Write buffer to temp file
        const tempPath = path.join(process.cwd(), 'uploads', `temp_${Date.now()}.epub`);
        fs.writeFileSync(tempPath, buffer);
        
        try {
          // Create EPUB instance with error handling
          const epub = new EPub(tempPath);
          
          epub.on('end', () => {
            let fullText = '';
            
            try {
              // Check if flow exists and has items
              if (!epub.flow || epub.flow.length === 0) {
                // No chapters found, create a simple fallback
                fullText = `## EPUB Content\nNo chapters could be detected automatically.`;
                // Clean up and resolve
                if (fs.existsSync(tempPath)) {
                  fs.unlinkSync(tempPath);
                }
                resolve(fullText);
                return;
              }
              
              // Process normal flow-based chapters
              let processedChapters = 0;
              
              epub.flow.forEach((chapter, index) => {
                try {
                  epub.getChapter(chapter.id, (err: Error | null, text: string) => {
                    processedChapters++;
                    
                    if (!err && text) {
                      // Strip HTML tags and add chapter text
                      const strippedText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
                      fullText += `\n## Chapter ${index + 1}\n${strippedText}\n`;
                    }
                    
                    // If all chapters are processed, resolve
                    if (processedChapters >= epub.flow.length) {
                      // Clean up temp file
                      if (fs.existsSync(tempPath)) {
                        fs.unlinkSync(tempPath);
                      }
                      resolve(fullText.trim() || `## EPUB Content\nNo content could be extracted from this EPUB.`);
                    }
                  });
                } catch (chapterError) {
                  processedChapters++;
                  // If all chapters are processed (even with errors), resolve
                  if (processedChapters >= epub.flow.length) {
                    if (fs.existsSync(tempPath)) {
                      fs.unlinkSync(tempPath);
                    }
                    resolve(fullText.trim() || `## EPUB Content\nNo content could be extracted from this EPUB.`);
                  }
                }
              });
            } catch (flowError) {
              // Handle flow processing errors
              if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
              }
              resolve(`## EPUB Content\nFailed to process EPUB content structure.`);
            }
          });
          
          epub.on('error', () => {
            // Clean up temp file on error
            if (fs.existsSync(tempPath)) {
              fs.unlinkSync(tempPath);
            }
            // Provide a fallback instead of failing
            resolve(`## EPUB Error\nFailed to parse EPUB file.`);
          });
          
          // Start parsing the EPUB
          epub.parse();
        } catch (epubError) {
          // Handle EPUB constructor errors
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
          resolve(`## EPUB Error\nFailed to process EPUB file format.`);
        }
      } catch (fileError) {
        // Handle file system errors
        resolve(`## EPUB Error\nFailed to process EPUB file.`);
      }
    });
  }
  
  /**
   * Extract text from PDF file
   */
  private async extractTextFromPdf(buffer: Buffer): Promise<string> {
    try {
      // Parse the PDF
      const data = await pdfParse(buffer);
      
      // Basic attempt to identify chapters by page breaks or chapter headings
      let processedText = data.text || '';
      
      // Try to identify chapters by common patterns
      const chapterPatterns = [
        /chapter\s+(\d+|[ivxlcdm]+)/gi,
        /section\s+(\d+|[ivxlcdm]+)/gi,
        /part\s+(\d+|[ivxlcdm]+)/gi
      ];
      
      // Insert chapter markers if patterns are found
      for (const pattern of chapterPatterns) {
        processedText = processedText.replace(
          pattern, 
          (match) => `\n## ${match}\n`
        );
      }
      
      // If no chapters were detected, use page breaks to divide content
      if (!processedText.includes('\n## ')) {
        const pages = processedText.split('\n\n');
        if (pages.length > 1) {
          processedText = '';
          let pageCounter = 1;
          
          for (const page of pages) {
            if (page.trim()) {
              // Every 5 pages becomes a new chapter for better chunking
              if (pageCounter % 5 === 1) {
                processedText += `\n## Section ${Math.floor(pageCounter / 5) + 1}\n`;
              }
              processedText += page + '\n\n';
              pageCounter++;
            }
          }
        }
      }
      
      return processedText;
    } catch (error) {
      console.error('Error parsing PDF:', error);
      // Fallback if PDF parsing fails
      return `## PDF Content\nUnable to extract structured content from PDF. Please try a text file for better results.`;
    }
  }
  
  /**
   * Upload file to storage and extract text
   * This implements the "/upload-ebook" edge function functionality
   * Now supports txt, epub, and pdf files
   */
  async uploadAndExtractText(file: any): Promise<TextExtractionResult> {
    try {
      // Process the file to extract text - properly handling the async result
      const processedFile = await this.processFile(file);
      
      // Generate a unique key for storage
      const textContent = processedFile.text || '';
      const contentHash = createHash('md5').update(textContent).digest('hex');
      const fileKey = `uploads/${contentHash}_${file.originalname}`;
      
      // Store the file in the simulated S3 storage
      const storedFile = await storageService.storeFile(
        file.buffer,
        fileKey,
        file.originalname,
        file.mimetype
      );
      
      // Update analytics with the correct file type
      const charCount = textContent.length;
      await this.updateFileAnalytics(processedFile.fileType, charCount);
      
      return {
        text: textContent,
        fileInfo: storedFile,
        charCount,
        fileType: processedFile.fileType
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