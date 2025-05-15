import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as fs from 'fs';
import * as path from 'path';
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

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
      // Validate request using domain schema
      const parsedBody = textToSpeechSchema.safeParse(req.body);
      if (!parsedBody.success) {
        const validationError = fromZodError(parsedBody.error);
        return res.status(400).json({ error: validationError.message });
      }

      // Execute the use case
      const result = await generateAudiobookUseCase(parsedBody.data);
      
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
        return res.status(500).json({ error: error.message });
      }
      return res.status(500).json({ error: "Failed to generate audio" });
    }
  });
  
  // Edge Function: Convert text directly to audio
  app.post("/api/convert-to-audio", async (req: Request, res: Response) => {
    try {
      const { text, voiceId, title } = req.body;
      
      // Validate request
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "Text is required and must be a string" });
      }
      
      if (!voiceId || typeof voiceId !== 'string') {
        return res.status(400).json({ error: "VoiceId is required and must be a string" });
      }
      
      if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: "Title is required and must be a string" });
      }
      
      // Check if text is not too long (ElevenLabs has a 5000 character limit per request)
      if (text.length > 5000) {
        return res.status(400).json({ 
          error: "Text is too long, maximum 5000 characters allowed per request" 
        });
      }
      
      // Generate audio with ElevenLabs API
      const audioUrl = await audioService.convertTextToSpeech({
        text,
        voiceId,
        title
      });
      
      // Get file path and check if it exists
      const fileName = path.basename(audioUrl);
      const { exists, filePath } = audioService.getAudioFilePath(fileName);
      
      if (!exists) {
        return res.status(500).json({ error: "Failed to generate audio file" });
      }
      
      // Get file stats for additional metadata
      const stats = fs.statSync(filePath);
      const fileSizeInBytes = stats.size;
      
      // Estimate audio duration (1.5KB per second at 128kbps)
      const estimatedDurationInSeconds = Math.ceil(fileSizeInBytes / 1500);
      
      // Return audio URL and metadata
      res.json({
        success: true,
        audioUrl,
        fileName,
        fileSize: fileSizeInBytes,
        duration: estimatedDurationInSeconds,
        mimeType: 'audio/mpeg'
      });
    } catch (error) {
      console.error("Convert-to-audio error:", error);
      if (error instanceof Error) {
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
