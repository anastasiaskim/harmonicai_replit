/**
 * Infrastructure Layer: Storage Service
 * Simulates S3-like storage functionality for files
 */
import * as fs from 'fs';
import * as path from 'path';

export interface StoredFile {
  key: string;         // Unique identifier for the file (S3 key)
  fileName: string;    // Original file name
  filePath: string;    // Local file path
  fileUrl: string;     // URL to access the file
  mimeType: string;    // File MIME type
  size: number;        // File size in bytes
  createdAt: string;   // ISO timestamp of when the file was created
}

class StorageService {
  /**
   * Store a file in the storage system
   * In production, this would upload to S3 or similar cloud storage
   */
  async storeFile(
    fileBuffer: Buffer, 
    key: string, 
    originalFileName: string, 
    mimeType: string
  ): Promise<StoredFile> {
    try {
      // Get the directory from the key
      const directory = path.dirname(key);
      const localDirectory = path.join(process.cwd(), directory);
      
      // Ensure the directory exists
      if (!fs.existsSync(localDirectory)) {
        fs.mkdirSync(localDirectory, { recursive: true });
      }
      
      // Define the full path
      const filePath = path.join(process.cwd(), key);
      
      // Write the file
      fs.writeFileSync(filePath, fileBuffer);
      
      // Get file size
      const stats = fs.statSync(filePath);
      
      // Create the URL for the file
      // In a real implementation, this would be a CDN or S3 URL
      const fileUrl = `/${key}`;
      
      const storedFile: StoredFile = {
        key,
        fileName: originalFileName,
        filePath,
        fileUrl,
        mimeType,
        size: stats.size,
        createdAt: new Date().toISOString()
      };
      
      return storedFile;
    } catch (error) {
      console.error('Error storing file:', error);
      throw new Error('Failed to store file');
    }
  }

  /**
   * Get a file from storage by its key
   */
  getFile(key: string): StoredFile | null {
    try {
      const filePath = path.join(process.cwd(), key);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }
      
      const stats = fs.statSync(filePath);
      const fileName = path.basename(key);
      const mimeType = this.getMimeTypeFromKey(key);
      
      const storedFile: StoredFile = {
        key,
        fileName,
        filePath,
        fileUrl: `/${key}`,
        mimeType,
        size: stats.size,
        createdAt: stats.birthtime.toISOString()
      };
      
      return storedFile;
    } catch (error) {
      console.error('Error getting file:', error);
      return null;
    }
  }
  
  /**
   * Get the contents of a file as a buffer
   */
  getFileBuffer(key: string): Buffer | null {
    try {
      const filePath = path.join(process.cwd(), key);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }
      
      return fs.readFileSync(filePath);
    } catch (error) {
      console.error('Error getting file buffer:', error);
      return null;
    }
  }
  
  /**
   * Serve a file from storage
   */
  serveFile(key: string): { buffer: Buffer; file: StoredFile } | null {
    try {
      const file = this.getFile(key);
      if (!file) {
        return null;
      }
      
      const buffer = this.getFileBuffer(key);
      if (!buffer) {
        return null;
      }
      
      return { buffer, file };
    } catch (error) {
      console.error('Error serving file:', error);
      return null;
    }
  }
  
  /**
   * Infer MIME type from file key (extension)
   */
  private getMimeTypeFromKey(key: string): string {
    const extension = path.extname(key).toLowerCase();
    
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.mp3': 'audio/mpeg',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png'
    };
    
    return mimeTypes[extension] || 'application/octet-stream';
  }
}

export const storageService = new StorageService();