/**
 * Infrastructure Layer: File Service
 * Handles file operations like upload and storage
 */

import * as fs from 'fs';
import * as path from 'path';
import { storage } from '../storage';

export class FileService {
  /**
   * Save a file to the upload directory
   * 
   * @param file The file to save
   * @returns The path to the saved file
   */
  saveFile(file: Express.Multer.File): string {
    const uploadDir = path.resolve(process.cwd(), 'uploads');
    
    // Create the upload directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    // Generate a unique filename
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filepath = path.join(uploadDir, filename);
    
    // Write the file to disk
    fs.writeFileSync(filepath, file.buffer);
    
    return filepath;
  }
  
  /**
   * Read a file from the upload directory
   * 
   * @param filename The name of the file to read
   * @returns The file content as a string
   */
  readFile(filename: string): string {
    const filepath = path.join(process.cwd(), 'uploads', filename);
    
    if (!fs.existsSync(filepath)) {
      throw new Error(`File not found: ${filename}`);
    }
    
    return fs.readFileSync(filepath, 'utf-8');
  }
}

export const fileService = new FileService();