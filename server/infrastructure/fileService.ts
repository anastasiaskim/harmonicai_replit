/**
 * Infrastructure Layer: File Service
 * Manages file operations and abstracts file system interactions
 */
import * as fs from 'fs';
import * as path from 'path';
import { storage } from '../storage';

const uploadDir = path.resolve(process.cwd(), 'uploads');

export interface FileProcessingResult {
  text: string;
  fileType: string;
}

class FileService {
  /**
   * Process an uploaded file and extract its content
   */
  processFile(file: any): FileProcessingResult {
    const { originalname, buffer, mimetype } = file;
    let text = '';
    let fileType = '';
    
    // Determine file type and extract content
    if (mimetype === "text/plain" || originalname.endsWith(".txt")) {
      text = buffer.toString("utf-8");
      fileType = "txt";
    } else if (mimetype === "application/pdf" || originalname.endsWith(".pdf")) {
      // For MVP, we just pretend to parse PDF but return the plain text
      text = `${originalname} content. In the production app, this would be the parsed PDF content.`;
      fileType = "pdf";
    } else if (mimetype === "application/epub+zip" || originalname.endsWith(".epub")) {
      // For MVP, we just pretend to parse EPUB but return the plain text
      text = `${originalname} content. In the production app, this would be the parsed EPUB content.`;
      fileType = "epub";
    } else {
      throw new Error("Invalid file type. Only TXT, EPUB, and PDF are supported.");
    }
    
    return { text, fileType };
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
  
  /**
   * Get file path in upload directory
   */
  getFilePath(filename: string): string {
    return path.join(uploadDir, filename);
  }
  
  /**
   * Create a file in the upload directory
   */
  createFile(filename: string, content: Buffer): void {
    const filePath = this.getFilePath(filename);
    fs.writeFileSync(filePath, content);
  }
  
  /**
   * Check if a file exists
   */
  fileExists(filename: string): boolean {
    const filePath = this.getFilePath(filename);
    return fs.existsSync(filePath);
  }
}

export const fileService = new FileService();