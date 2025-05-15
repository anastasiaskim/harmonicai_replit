/**
 * Infrastructure Layer: Storage Service
 * Handles file storage and retrieval
 */

import * as fs from 'fs';
import * as path from 'path';
import { storage } from '../storage';

export class StorageService {
  /**
   * Serve a file from storage
   * 
   * @param key The storage key for the file
   * @returns Object with file info and buffer, or null if file not found
   */
  serveFile(key: string): { 
    file: { 
      fileName: string; 
      mimeType: string; 
      size: number 
    }; 
    buffer: Buffer 
  } | null {
    try {
      // Parse the key to get the directory and filename
      const parts = key.split('/');
      const dir = parts[0];
      const fileName = parts[1];
      
      if (!dir || !fileName) {
        console.error(`Invalid storage key: ${key}`);
        return null;
      }
      
      // Build the filepath
      const filePath = path.join(process.cwd(), dir, fileName);
      
      // Check if the file exists
      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return null;
      }
      
      // Read the file
      const buffer = fs.readFileSync(filePath);
      
      // Determine MIME type (simplified for MVP)
      let mimeType = 'application/octet-stream';
      if (fileName.endsWith('.mp3')) {
        mimeType = 'audio/mpeg';
      } else if (fileName.endsWith('.txt')) {
        mimeType = 'text/plain';
      } else if (fileName.endsWith('.json')) {
        mimeType = 'application/json';
      }
      
      // Get file stats
      const stats = fs.statSync(filePath);
      
      return {
        file: {
          fileName,
          mimeType,
          size: stats.size
        },
        buffer
      };
    } catch (error) {
      console.error(`Error serving file ${key}:`, error);
      return null;
    }
  }
}

export const storageService = new StorageService();