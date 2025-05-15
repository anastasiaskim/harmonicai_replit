import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as fs from 'fs';
import * as path from 'path';
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import JSZip from "jszip";

// Import domain layer
import { textToSpeechSchema } from "@shared/schema";
import { storage } from "./storage";

// Import schemas from use cases
import { apiKeySchema, chapterDetectionSchema } from "./application/useCases";

// Import application layer
import { 
  apiKeyUseCase,
  chapterDetectionUseCase
} from "./application/useCases";

// Import infrastructure services
import { chapterService } from "./infrastructure/chapterService";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
});

// Create uploads directory if it doesn't exist
const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // API Endpoints (Presentation Layer for API)
  
  // Get available voices
  app.get("/api/voices", async (_req: Request, res: Response) => {
    try {
      const voices = await storage.getVoices();
      res.json(voices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch voices" });
    }
  });

  // Upload ebook and extract text (Phase 2 Edge Function)
  app.post(
    "/api/upload-ebook",
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        // Basic validation
        if (!req.file) {
          return res.status(400).json({ error: "No file provided" });
        }

        // Simple file processing for text extraction
        const buffer = req.file.buffer;
        const filename = req.file.originalname;
        const text = buffer.toString('utf-8');
        
        // Store the file with a unique name
        const uploadPath = path.join(uploadDir, `${Date.now()}-${filename}`);
        fs.writeFileSync(uploadPath, buffer);
        
        // Return the extracted text and file metadata
        const result = {
          text,
          fileMetadata: {
            key: uploadPath,
            name: filename,
            size: buffer.length,
            url: `/uploads/${path.basename(uploadPath)}`,
            mimeType: req.file.mimetype
          },
          charCount: text.length
        };

        return res.json(result);
      } catch (error) {
        console.error("Upload error:", error);
        return res.status(500).json({ 
          error: error instanceof Error ? error.message : "Failed to process file" 
        });
      }
    }
  );
  
  // Keep the original endpoint for backward compatibility
  app.post(
    "/api/upload",
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        // Basic validation
        if (!req.file && !req.body.text) {
          return res.status(400).json({ error: "No file or text provided" });
        }

        // Process the input (file or direct text)
        let text = '';
        let fileMetadata = null;
        
        // Process file if provided
        if (req.file) {
          const buffer = req.file.buffer;
          const filename = req.file.originalname;
          text = buffer.toString('utf-8');
          
          // Store the file with a unique name
          const uploadPath = path.join(uploadDir, `${Date.now()}-${filename}`);
          fs.writeFileSync(uploadPath, buffer);
          
          fileMetadata = {
            key: uploadPath,
            name: filename,
            size: buffer.length,
            url: `/uploads/${path.basename(uploadPath)}`,
            mimeType: req.file.mimetype
          };
        } else if (req.body.text) {
          // Use direct text input
          text = req.body.text;
        }
        
        // Return the result
        const result = {
          text,
          fileMetadata,
          charCount: text.length
        };

        return res.json(result);
      } catch (error) {
        console.error("Upload error:", error);
        return res.status(500).json({ 
          error: error instanceof Error ? error.message : "Failed to process file" 
        });
      }
    }
  );

  // Convert text to speech using ElevenLabs API
  app.post("/api/text-to-speech", async (req: Request, res: Response) => {
    try {
      console.log("Received text-to-speech request with body length:", JSON.stringify(req.body).length);
      
      // Validate request using domain schema
      const parsedBody = textToSpeechSchema.safeParse(req.body);
      if (!parsedBody.success) {
        const validationError = fromZodError(parsedBody.error);
        console.log("Validation error:", validationError.message);
        return res.status(400).json({ error: validationError.message });
      }

      console.log("Request validated successfully");
      console.log("Processing", parsedBody.data.chapters.length, "chapters");

      // Execute the use case
      const result = await generateAudiobookUseCase(parsedBody.data);
      
      console.log("Generated audiobook successfully with", result.length, "chapters");
      
      res.json({
        success: true,
        chapters: result
      });
    } catch (error) {
      console.error("Text-to-speech conversion error:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      if (error instanceof Error) {
        console.error("Error details:", error.stack);
        return res.status(500).json({ error: error.message });
      }
      return res.status(500).json({ error: "Failed to generate audio" });
    }
  });
  
  // Edge Function: Convert text directly to audio
  app.post("/api/convert-to-audio", async (req: Request, res: Response) => {
    try {
      console.log("Received convert-to-audio request");
      const { text, voiceId, title } = req.body;
      
      // Validate request
      if (!text || typeof text !== 'string') {
        console.log("Invalid request: Missing or invalid text");
        return res.status(400).json({ error: "Text is required and must be a string" });
      }
      
      if (!voiceId || typeof voiceId !== 'string') {
        console.log("Invalid request: Missing or invalid voiceId");
        return res.status(400).json({ error: "VoiceId is required and must be a string" });
      }
      
      if (!title || typeof title !== 'string') {
        console.log("Invalid request: Missing or invalid title");
        return res.status(400).json({ error: "Title is required and must be a string" });
      }
      
      console.log(`Processing conversion request: title="${title}", voice="${voiceId}", text length=${text.length}`);
      
      // Our improved audioService.convertTextToSpeech handles chunking
      console.log(`Processing text of length ${text.length} characters - chunking will be handled automatically`);
      
      // Generate audio with ElevenLabs API
      console.log("Calling ElevenLabs API...");
      const audioUrl = await audioService.convertTextToSpeech({
        text,
        voiceId,
        title
      });
      console.log(`Audio generation successful, URL: ${audioUrl}`);
      
      // Get file path and check if it exists
      const fileName = path.basename(audioUrl);
      const { exists, filePath } = audioService.getAudioFilePath(fileName);
      console.log(`Audio file path: ${filePath}, exists: ${exists}`);
      
      if (!exists) {
        console.log("Error: Generated audio file does not exist");
        return res.status(500).json({ error: "Failed to generate audio file" });
      }
      
      // Get file stats for additional metadata
      const stats = fs.statSync(filePath);
      const fileSizeInBytes = stats.size;
      
      // Estimate audio duration (1.5KB per second at 128kbps)
      const estimatedDurationInSeconds = Math.ceil(fileSizeInBytes / 1500);
      console.log(`File size: ${fileSizeInBytes} bytes, estimated duration: ${estimatedDurationInSeconds} seconds`);
      
      // Return audio URL and metadata
      const response = {
        success: true,
        audioUrl,
        fileName,
        fileSize: fileSizeInBytes,
        duration: estimatedDurationInSeconds,
        mimeType: 'audio/mpeg'
      };
      
      console.log("Sending successful response:", response);
      res.json(response);
    } catch (error) {
      console.error("Convert-to-audio error:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
        return res.status(500).json({ error: error.message });
      }
      return res.status(500).json({ error: "Failed to convert text to audio" });
    }
  });

  // Serve audio files (legacy endpoint)
  app.get("/api/audio/:filename", (req: Request, res: Response) => {
    const filename = req.params.filename;
    
    try {
      const { filePath, exists } = audioService.getAudioFilePath(filename);
      
      if (!exists) {
        return res.status(404).json({ error: "Audio file not found" });
      }
      
      // Set headers for audio streaming
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      
      // Stream the file to the client
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error serving audio file:", error);
      return res.status(500).json({ error: "Failed to serve audio file" });
    }
  });
  
  // Serve files from storage (uploads or audio)
  app.get("/uploads/:filename", (req: Request, res: Response) => {
    const key = `uploads/${req.params.filename}`;
    serveStoredFile(key, res);
  });
  
  app.get("/audio/:filename", (req: Request, res: Response) => {
    const key = `audio/${req.params.filename}`;
    serveStoredFile(key, res);
  });
  
  // Helper function to serve files from storage
  function serveStoredFile(key: string, res: Response) {
    try {
      const fileData = storageService.serveFile(key);
      
      if (!fileData) {
        return res.status(404).json({ error: "File not found" });
      }
      
      // Set appropriate headers
      res.setHeader('Content-Type', fileData.file.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename=${fileData.file.fileName}`);
      
      // Send the file
      res.send(fileData.buffer);
    } catch (error) {
      console.error("Error serving file:", error);
      return res.status(500).json({ error: "Failed to serve file" });
    }
  }

  // AI-powered chapter detection
  app.post("/api/detect-chapters", async (req: Request, res: Response) => {
    try {
      console.log("Received AI chapter detection request");
      const { text, useAI = true } = req.body;
      
      // Validate request using our schema
      try {
        const validatedData = chapterDetectionSchema.parse({ text, useAI });
        
        // Use the AI-powered chapter detection use case
        console.log("Calling AI-powered chapter detection use case");
        const result = await chapterDetectionUseCase.detectChapters(validatedData.text, validatedData.useAI);
        console.log(`Detection result: ${result.chapters.length} chapters detected, wasChunked=${result.wasChunked}, usedAI=${result.aiDetection}`);
        
        return res.json(result);
      } catch (validationError) {
        if (validationError instanceof ZodError) {
          const readableError = fromZodError(validationError);
          return res.status(400).json({ error: readableError.message });
        }
        throw validationError;
      }
    } catch (error) {
      console.error("AI chapter detection error:", error);
      if (error instanceof Error) {
        return res.status(500).json({ error: error.message });
      }
      return res.status(500).json({ error: "Failed to detect chapters with AI" });
    }
  });
  
  // API Key management
  app.post("/api/api-keys", async (req: Request, res: Response) => {
    try {
      // Validate request using our schema
      try {
        const validatedData = apiKeySchema.parse(req.body);
        
        // Use the API key use case to validate and store the key
        const result = await apiKeyUseCase.setApiKey(validatedData.service, validatedData.key);
        
        return res.json(result);
      } catch (validationError) {
        if (validationError instanceof ZodError) {
          const readableError = fromZodError(validationError);
          return res.status(400).json({ error: readableError.message });
        }
        throw validationError;
      }
    } catch (error) {
      console.error("API key management error:", error);
      if (error instanceof Error) {
        return res.status(500).json({ error: error.message });
      }
      return res.status(500).json({ error: "Failed to manage API key" });
    }
  });

  // Server-side chapter ZIP creation and download
  app.post("/api/download", async (req: Request, res: Response) => {
    try {
      console.log("Received chapter download request");
      const { text, bookTitle = "Untitled Book", userId = "default" } = req.body;
      
      // Validate request
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "Text content is required" });
      }
      
      // Try AI-powered chapter detection first
      let chunkingResult;
      try {
        console.log("Attempting AI-powered chapter detection");
        chunkingResult = await chapterDetectionUseCase.detectChapters(text, userId);
        console.log(`AI detection result: ${chunkingResult.chapters.length} chapters, wasChunked=${chunkingResult.wasChunked}, usedAI=${chunkingResult.aiDetection}`);
      } catch (aiError) {
        console.error("AI chapter detection failed, falling back to regex detection:", aiError);
        // Fallback to regex-based chapter detection
        chunkingResult = chapterService.detectChaptersDetailed(text);
        console.log(`Fallback detection result: ${chunkingResult.chapters.length} chapters, wasChunked=${chunkingResult.wasChunked}`);
      }
      
      console.log(`Detected ${chunkingResult.chapters.length} chapters in the text`);
      console.log(`Was chunking successful? ${chunkingResult.wasChunked ? 'Yes' : 'No'}`);
      
      // Even if no chapters were detected, we'll still return the original text as a single chapter
      
      // Create a ZIP archive in memory
      console.log("Creating ZIP archive...");
      const zip = new JSZip();
      
      // Helper function to create a safe filename
      const safeFileName = (title: string): string => {
        const cleanTitle = title
          .replace(/[^a-z0-9]/gi, '_')
          .replace(/_+/g, '_')
          .toLowerCase()
          .trim();
        return cleanTitle.substring(0, 50);
      };
      
      // Check if chunking was successful
      if (chunkingResult.wasChunked) {
        // Create a table of contents file
        let tocContent = `${bookTitle}\nTable of Contents\n\n`;
        chunkingResult.chapters.forEach((chapter: { title: string; text: string }, index: number) => {
          tocContent += `${index + 1}. ${chapter.title}\n`;
        });
        zip.file("00_table_of_contents.txt", tocContent);
        
        // Add each chapter as a separate text file
        chunkingResult.chapters.forEach((chapter: { title: string; text: string }, index: number) => {
          // Create a safe filename with numeric prefix for ordering
          const fileName = `${String(index + 1).padStart(2, '0')}_${safeFileName(chapter.title)}.txt`;
          
          // Format chapter content with proper headers
          let content = `${chapter.title}\n`;
          content += '='.repeat(chapter.title.length) + '\n\n';
          content += chapter.text;
          
          // Add file to the ZIP archive
          zip.file(fileName, content);
        });
        
        // Generate the ZIP file as a buffer
        console.log("Generating ZIP file with multiple chapters...");
        const zipBuffer = await zip.generateAsync({
          type: "nodebuffer",
          compression: "DEFLATE",
          compressionOptions: {
            level: 6
          }
        });
        
        // Set response headers for file download
        const zipFileName = `${safeFileName(bookTitle)}_chapters.zip`;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename=${zipFileName}`);
        res.setHeader('Content-Length', zipBuffer.length);
        
        // Send the ZIP file to the client
        console.log(`Sending ZIP file: ${zipFileName} (${zipBuffer.length} bytes)`);
        res.send(zipBuffer);
      } else {
        // Chunking was not successful, return a single text file instead
        console.log("Chunking was not successful, returning a single text file");
        
        // Add a header to explain why the file wasn't chunked
        let content = `${bookTitle}\n`;
        content += '='.repeat(bookTitle.length) + '\n\n';
        content += "Note: This book could not be automatically divided into chapters.\n";
        content += "The complete text is provided below.\n\n";
        content += "---\n\n";
        content += chunkingResult.originalText;
        
        // Set response headers for single file download
        const fileName = `${safeFileName(bookTitle)}.txt`;
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        
        // Send the single file to the client
        console.log(`Sending single file: ${fileName} (${content.length} bytes)`);
        res.send(content);
      }
    } catch (error) {
      console.error("Error creating chapter ZIP:", error);
      if (error instanceof Error) {
        return res.status(500).json({ error: error.message });
      }
      return res.status(500).json({ error: "Failed to create chapter files" });
    }
  });
  
  // Get analytics
  app.get("/api/analytics", async (_req: Request, res: Response) => {
    try {
      const analytics = await getAnalyticsUseCase();
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
