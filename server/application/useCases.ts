/**
 * Application Layer: Use Cases
 * Orchestrates the application logic by coordinating domain and infrastructure components
 */
import { createInsertSchema } from "drizzle-zod";
import { 
  TextToSpeechRequest, 
  Voice, 
  InsertChapter, 
  insertChapterSchema,
  Chapter
} from "@shared/schema";
import { storage } from "../storage";
import { fileService, FileProcessingResult } from "../infrastructure/fileService";
import { chapterService, ChapterDTO } from "../infrastructure/chapterService";
import { audioService } from "../infrastructure/audioService";

export interface ProcessTextInput {
  file?: any; // Multer file
  directText?: string;
}

export interface FileMetadata {
  key: string;
  name: string;
  size: number;
  url: string;
  mimeType: string;
}

export interface ProcessTextOutput {
  text: string;
  chapters: { title: string; text: string }[];
  charCount: number;
  fileMetadata?: FileMetadata | null;
  wasChunked: boolean;  // Indicates if chapter detection was successful
  patternMatchCounts?: Record<string, number>; // Statistics on pattern matches
}

/**
 * Use Case: Get Voices
 * Retrieves available voice options
 */
export async function getVoicesUseCase(): Promise<Voice[]> {
  return storage.getVoices();
}

/**
 * Use Case: Process Text
 * Handles text processing from file uploads or direct text input
 */
export async function processTextUseCase(input: ProcessTextInput): Promise<ProcessTextOutput> {
  try {
    let result: FileProcessingResult;
    let fileMetadata: FileMetadata | null = null;
    
    if (input.file) {
      // Process uploaded file
      const textExtractionResult = await fileService.uploadAndExtractText(input.file);
      
      // Create file metadata for frontend
      fileMetadata = {
        key: textExtractionResult.fileInfo.key,
        name: textExtractionResult.fileInfo.fileName,
        size: textExtractionResult.fileInfo.size,
        url: textExtractionResult.fileInfo.fileUrl,
        mimeType: textExtractionResult.fileInfo.mimeType
      };
      
      result = {
        text: textExtractionResult.text,
        fileType: textExtractionResult.fileType
      };
      
      // Update analytics
      await fileService.updateFileAnalytics(
        textExtractionResult.fileType, 
        textExtractionResult.charCount
      );
    } else if (input.directText) {
      // Process direct text input
      result = {
        text: input.directText,
        fileType: 'text'
      };
    } else {
      throw new Error("No file or text provided");
    }
    
    // Detect chapters in the text with detailed information
    const chunkingResult = chapterService.detectChaptersDetailed(result.text);
    
    return {
      text: result.text,
      chapters: chunkingResult.chapters,
      charCount: result.text.length,
      fileMetadata: fileMetadata,
      wasChunked: chunkingResult.wasChunked,
      patternMatchCounts: chunkingResult.patternMatchCounts
    };
  } catch (error) {
    console.error("Error in processTextUseCase:", error);
    throw error;
  }
}

/**
 * Use Case: Generate Audiobook
 * Coordinates the process of converting text to speech and storing the results
 */
export async function generateAudiobookUseCase(request: TextToSpeechRequest): Promise<Chapter[]> {
  try {
    const { chapters: textChapters, voiceId } = request;
    const generatedChapters: InsertChapter[] = [];
    
    // Process each chapter
    for (const chapter of textChapters) {
      const chapterData: ChapterDTO = {
        title: chapter.title,
        text: chapter.text
      };
      
      // Generate audio for the chapter
      const processedChapter = await audioService.generateAudio(
        chapterData, 
        voiceId,
        true // Enable real API call
      );
      
      generatedChapters.push(processedChapter);
    }
    
    // Store chapters in database
    const storedChapters = await storage.insertChapters(generatedChapters);
    
    return storedChapters;
  } catch (error) {
    console.error("Error in generateAudiobookUseCase:", error);
    throw error;
  }
}

/**
 * Use Case: Get Analytics
 * Retrieves usage analytics
 */
export async function getAnalyticsUseCase() {
  try {
    const analytics = await storage.getAnalytics();
    return analytics || {
      id: 0,
      fileUploads: 0,
      textInputs: 0,
      conversions: 0,
      characterCount: 0,
      fileTypes: {},
      voiceUsage: {},
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    console.error("Error in getAnalyticsUseCase:", error);
    throw error;
  }
}