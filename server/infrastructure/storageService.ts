/**
 * Infrastructure Layer: Storage Service
 * Simulates S3-like storage functionality for files
 */
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

// Storage directory paths
const STORAGE_DIR = path.resolve(process.cwd(), 'storage');
const UPLOADS_DIR = path.join(STORAGE_DIR, 'uploads');
const AUDIO_DIR = path.join(STORAGE_DIR, 'audio');

// Ensure storage directories exist
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

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
    fileName: string, 
    mimeType: string,
    directory: 'uploads' | 'audio' = 'uploads'
  ): Promise<StoredFile> {
    try {
      // Generate a unique key for the file
      const fileHash = createHash('md5')
        .update(fileBuffer)
        .update(fileName)
        .update(Date.now().toString())
        .digest('hex');
      
      // Clean the filename
      const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      
      // Format: {directory}/{fileHash}_{cleanFileName}
      const key = `${directory}/${fileHash}_${cleanFileName}`;
      
      // Determine the target directory
      const targetDir = directory === 'audio' ? AUDIO_DIR : UPLOADS_DIR;
      
      // Create the full file path
      const filePath = path.join(targetDir, `${fileHash}_${cleanFileName}`);
      
      // Write the file
      fs.writeFileSync(filePath, fileBuffer);
      
      // Get the file size
      const stats = fs.statSync(filePath);
      
      // Generate a URL to access the file
      // In production this would be an S3 URL or a signed URL
      const fileUrl = `/${directory}/${fileHash}_${cleanFileName}`;
      
      // Create and return the file metadata
      const storedFile: StoredFile = {
        key,
        fileName: cleanFileName,
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
      // Parse the key to get directory and filename
      const [directory, filename] = key.split('/');
      
      if (!directory || !filename) {
        return null;
      }
      
      // Determine the target directory
      const targetDir = directory === 'audio' ? AUDIO_DIR : UPLOADS_DIR;
      
      // Create the full file path
      const filePath = path.join(targetDir, filename);
      
      // Check if the file exists
      if (!fs.existsSync(filePath)) {
        return null;
      }
      
      // Get the file stats
      const stats = fs.statSync(filePath);
      
      // Get file MIME type based on extension
      const extension = path.extname(filename).toLowerCase();
      let mimeType = 'application/octet-stream';
      
      switch (extension) {
        case '.txt':
          mimeType = 'text/plain';
          break;
        case '.mp3':
          mimeType = 'audio/mpeg';
          break;
        // Add more MIME types as needed
      }
      
      // Create and return the file metadata
      const storedFile: StoredFile = {
        key,
        fileName: filename,
        filePath,
        fileUrl: `/${directory}/${filename}`,
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
      const file = this.getFile(key);
      
      if (!file) {
        return null;
      }
      
      return fs.readFileSync(file.filePath);
    } catch (error) {
      console.error('Error reading file buffer:', error);
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
      
      const buffer = fs.readFileSync(file.filePath);
      
      return {
        buffer,
        file
      };
    } catch (error) {
      console.error('Error serving file:', error);
      return null;
    }
  }
}

export const storageService = new StorageService();