import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as fs from 'fs';
import * as path from 'path';
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import JSZip from "jszip";

// Import domain layer
import { textToSpeechSchema } from "../shared/schema";

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
  // Serve static files from public directory for the parser demo
  const publicPath = path.resolve(process.cwd(), 'public');
  if (fs.existsSync(publicPath)) {
    // Only serve specific files from public directory
    app.use('/parser-demo.html', express.static(path.join(publicPath, 'parser-demo.html')));
    app.use('/js', express.static(path.join(publicPath, 'js')));
    app.use('/dist', express.static(path.join(publicPath, 'dist')));
    app.use('/style.css', express.static(path.join(publicPath, 'style.css')));
    app.use('/input.txt', express.static(path.join(publicPath, 'input.txt')));
  }
  
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
  
  // Edge Function: Convert text directly to audio - REMOVED

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
      
      // Detect chapters in the text with detailed information
      const chunkingResult = chapterService.detectChaptersDetailed(text);
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
  
  // API endpoint to check if an API key exists and is valid
  app.get("/api/check-secret", async (req: Request, res: Response) => {
    try {
      const { key } = req.query;
      
      if (!key || typeof key !== 'string') {
        return res.status(400).json({ error: "Key parameter is required" });
      }
      
      // Check if the environment variable exists
      const apiKey = process.env[key];
      const exists = !!apiKey && apiKey.length > 0;
      
      // For Eleven Labs specifically, test the key validity
      if (key === 'ELEVENLABS_API_KEY') {
        try {
          // If the key doesn't exist, return exists=false immediately
          if (!exists) {
            return res.json({ exists, isValid: false });
          }
          
          // Import and use the ElevenLabs service to check key validity
          const { elevenLabsService } = await import('./infrastructure/elevenLabsService');
          
          // Force initialize the client with the current key
          // This ensures we're checking with the most recent API key
          let isValid = false;
          try {
            // Import dynamically to ensure compatibility with ESM
            const elevenlabs = await import('elevenlabs');
            const client = new elevenlabs.ElevenLabs({
              apiKey: apiKey
            });
            
            const voices = await client.voices.getAll();
            isValid = !!voices;
            console.log("API key validation successful");
          } catch (err) {
            console.error("API key validation error:", err);
            isValid = false;
          }
          
          return res.json({ exists, isValid });
        } catch (error) {
          console.error("Error testing ElevenLabs API key:", error);
          return res.json({ exists, isValid: false });
        }
      }
      
      // For other keys, just return if they exist
      return res.json({ exists });
    } catch (error) {
      console.error("Error checking secret:", error);
      res.status(500).json({ error: "Failed to check secret" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
