/**
 * Infrastructure Layer: Storage Service
 * Handles file storage using Supabase Storage
 */
import * as fs from 'fs';
import * as path from 'path';
import { supabaseAdmin } from './supabaseClient';
import * as crypto from 'crypto';

export interface StoredFile {
  key: string;         // Unique identifier for the file (storage key)
  fileName: string;    // Original file name
  fileUrl: string;     // URL to access the file
  mimeType: string;    // File MIME type
  size: number;        // File size in bytes
  created_at: string;  // ISO timestamp of when the file was created
}

export class StorageService {
  private readonly bucketName: string;
  private readonly ALLOWED_CHARS = /^[a-zA-Z0-9\-_.]+$/;

  constructor() {
    this.bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'audio-files';
  }

  /**
   * Safely extracts a file name from a storage key, preventing path traversal attacks
   * @param key The storage key to extract the file name from
   * @returns A sanitized file name or a cryptographic hash-based filename if sanitization fails
   */
  private sanitizeFileName(key: string): string {
    try {
      // Decode URL-encoded characters to handle encoded path traversal attempts
      let decodedKey = decodeURIComponent(key);
      
      // Handle double-encoded sequences by decoding again
      if (decodedKey.includes('%')) {
        decodedKey = decodeURIComponent(decodedKey);
      }
      
      // Normalize the path to handle any path traversal attempts
      const normalizedPath = path.normalize(decodedKey);
      
      // Check for path traversal attempts after normalization
      if (normalizedPath.includes('..')) {
        throw new Error('Path traversal attempt detected');
      }
      
      // Use path.basename to safely get the last component of the path
      const baseName = path.basename(normalizedPath);
      
      // Remove any remaining path traversal sequences and normalize unicode
      const sanitized = baseName
        .normalize('NFKC') // Normalize unicode characters
        .replace(/\.\./g, '')
        .replace(/%2e%2e/gi, '')
        .replace(/[^\x20-\x7E]/g, ''); // Remove non-printable ASCII characters
      
      // Check if the sanitized name contains only allowed characters and is not empty
      if (!sanitized || !this.ALLOWED_CHARS.test(sanitized)) {
        // Generate a safe name using a cryptographic hash
        const hash = crypto.createHash('sha256').update(key).digest('hex');
        const ext = path.extname(baseName);
        return `${hash}${ext}`;
      }
      
      return sanitized;
    } catch (error) {
      // If any error occurs during sanitization, generate a safe hash-based filename
      const hash = crypto.createHash('sha256').update(key).digest('hex');
      const ext = path.extname(key);
      return `${hash}${ext}`;
    }
  }

  async uploadFile(filePath: string, key: string, mimeType: string): Promise<StoredFile> {
    try {
      const fileContent = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);

      const { data, error } = await supabaseAdmin.storage
        .from(this.bucketName)
        .upload(key, fileContent, {
          contentType: mimeType,
          upsert: true
        });

      if (error) throw error;

      const { data: urlData } = supabaseAdmin.storage
        .from(this.bucketName)
        .getPublicUrl(key);

      return {
        key,
        fileName,
        fileUrl: urlData.publicUrl,
        mimeType,
        size: fileContent.length,
        created_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  async getFile(key: string): Promise<Buffer | null> {
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(this.bucketName)
        .download(key);

      if (error) throw error;
      if (!data) return null;

      return Buffer.from(await data.arrayBuffer());
    } catch (error) {
      console.error('Error retrieving file:', error);
      return null;
    }
  }

  async deleteFile(key: string): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin.storage
        .from(this.bucketName)
        .remove([key]);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  async listFiles(prefix: string): Promise<string[]> {
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(this.bucketName)
        .list(prefix);

      if (error) throw error;
      return data.map(item => item.name);
    } catch (error) {
      console.error('Error listing files:', error);
      return [];
    }
  }

  async getFileMetadata(key: string): Promise<{
    LastModified: Date;
    ContentLength: number;
    ContentType: string;
    ETag: string;
  } | null> {
    try {
      const { data: urlData } = supabaseAdmin.storage
        .from(this.bucketName)
        .getPublicUrl(key);

      // Get file info
      const { data: fileData, error: fileError } = await supabaseAdmin.storage
        .from(this.bucketName)
        .list(path.dirname(key));

      if (fileError) throw fileError;

      const fileInfo = fileData.find(file => file.name === path.basename(key));
      if (!fileInfo) {
        throw new Error(`File not found: ${key}`);
      }

      return {
        LastModified: fileInfo.updated_at ? new Date(fileInfo.updated_at) : new Date(),
        ContentLength: fileInfo.metadata?.size || 0,
        ContentType: fileInfo.metadata?.mimetype || 'application/octet-stream',
        ETag: fileInfo.id || key
      };
    } catch (error) {
      console.error('Error getting file metadata:', error);
      return null;
    }
  }

  getPublicUrl(key: string): string {
    const { data } = supabaseAdmin.storage
      .from(this.bucketName)
      .getPublicUrl(key);
    return data.publicUrl;
  }

  /**
   * Serve a file by key, returning its buffer and metadata for download endpoints
   */
  async serveFile(key: string): Promise<{ buffer: Buffer; file: { fileName: string; mimeType: string; size: number } } | null> {
    try {
      const buffer = await this.getFile(key);
      if (!buffer) return null;
      
      const fileName = this.sanitizeFileName(key);
      const mimeType = this.getMimeTypeFromFileName(fileName) || 'application/octet-stream';
      const size = buffer.length;
      
      return {
        buffer,
        file: { fileName, mimeType, size }
      };
    } catch (error) {
      console.error('Error serving file:', error);
      return null;
    }
  }

  private getMimeTypeFromFileName(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'mp4': 'audio/mp4',
      'pdf': 'application/pdf',
      'txt': 'text/plain'
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }
}

export const storageService = new StorageService();