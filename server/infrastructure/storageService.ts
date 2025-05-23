/**
 * Infrastructure Layer: Storage Service
 * Handles file storage using Supabase Storage
 */
import * as fs from 'fs';
import * as path from 'path';
import { supabaseAdmin } from './supabaseClient';

export interface StoredFile {
  key: string;         // Unique identifier for the file (storage key)
  fileName: string;    // Original file name
  fileUrl: string;     // URL to access the file
  mimeType: string;    // File MIME type
  size: number;        // File size in bytes
  createdAt: string;   // ISO timestamp of when the file was created
}

export class StorageService {
  private readonly bucketName: string;

  constructor() {
    this.bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'audio-files';
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
        createdAt: new Date().toISOString()
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
}

export const storageService = new StorageService();