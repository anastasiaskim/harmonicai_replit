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

// Import application layer
import { 
  getVoicesUseCase, 
  processTextUseCase, 
  generateAudiobookUseCase,
  getAnalyticsUseCase
} from "./application/useCases";

// Import infrastructure services
import { fileService } from "./infrastructure/fileService";
import { chapterService } from "./infrastructure/chapterService";
import { audioService } from "./infrastructure/audioService";
import { storageService } from "./infrastructure/storageService";

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
      const voices = await getVoicesUseCase();
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

        // Process the file using the upload use case
        const result = await processTextUseCase({
          file: req.file
        });

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
        const result = await processTextUseCase({
          file: req.file, 
          directText: req.body.text
        });

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

  // Server-side chapter ZIP creation and download
  app.post("/api/download", async (req: Request, res: Response) => {
    try {
      console.log("Received chapter download request");
      const { text, bookTitle = "Untitled Book" } = req.body;
      
      // Validate request
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "Text content is required" });
      }
      
      // Detect chapters in the text
      const chapters = chapterService.detectChapters(text);
      console.log(`Detected ${chapters.length} chapters in the text`);
      
      if (chapters.length === 0) {
        return res.status(400).json({ error: "No chapters could be detected in the text" });
      }
      
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
      
      // Create a table of contents file
      let tocContent = `${bookTitle}\nTable of Contents\n\n`;
      chapters.forEach((chapter: { title: string; text: string }, index: number) => {
        tocContent += `${index + 1}. ${chapter.title}\n`;
      });
      zip.file("00_table_of_contents.txt", tocContent);
      
      // Add each chapter as a separate text file
      chapters.forEach((chapter: { title: string; text: string }, index: number) => {
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
      console.log("Generating ZIP file...");
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
