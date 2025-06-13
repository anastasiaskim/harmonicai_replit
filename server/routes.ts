import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as fs from 'fs';
import * as path from 'path';
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import JSZip from "jszip";
import { createClient } from '@supabase/supabase-js';
import { userService } from './infrastructure/userService';
import { SUBSCRIPTION_TIERS } from '@shared/schema';
import { supabaseAdmin } from './infrastructure/supabaseClient';
import { StorageService } from './infrastructure/storageService';
import { PassThrough } from 'stream';
import { ElevenLabsClient } from "elevenlabs";

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
import { queueService } from "./infrastructure/queueService";
import { metricsService } from "./infrastructure/metricsService";

// Validate required environment variables
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      subscriptionTier?: keyof typeof SUBSCRIPTION_TIERS;
      characterLimit?: number;
      charactersUsed?: number;
    }
    interface Request {
      user?: User;
    }
  }
}

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

// Debug logging utility
const debugLog = (message: string, data?: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${message}`, data ? data : '');
  }
};

/**
 * Maps a user's subscription tier to the correct enum key
 * @param subscriptionTier The user's subscription tier from the database
 * @returns The mapped subscription tier key or undefined if invalid
 */
function mapSubscriptionTier(subscriptionTier: string | null | undefined): keyof typeof SUBSCRIPTION_TIERS | undefined {
  if (!subscriptionTier) {
    return undefined;
  }
  
  const upperTier = subscriptionTier.toUpperCase();
  return upperTier in SUBSCRIPTION_TIERS ? upperTier as keyof typeof SUBSCRIPTION_TIERS : undefined;
}

// Authentication middleware
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    debugLog('Auth header received', authHeader ? '[PRESENT]' : '[MISSING]');
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    debugLog('Token received', token ? '[PRESENT]' : '[MISSING]');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    debugLog('Auth result', { 
      user: user ? '[AUTHENTICATED]' : '[NOT AUTHENTICATED]',
      error: error ? '[ERROR]' : '[NO ERROR]'
    });
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get or create user record
    let userRecord = await userService.getUser(user.id);
    if (!userRecord) {
      userRecord = await userService.createUser({
        id: user.id,
        email: user.email!,
      });
    }

    // Attach user to request with correct enum mapping for subscriptionTier
    req.user = {
      ...userRecord,
      subscriptionTier: mapSubscriptionTier(userRecord.subscriptionTier)
    };
    next();
  } catch (error) {
    console.error('Auth error:', error);
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? (error instanceof Error ? error.message : JSON.stringify(error))
      : 'Internal server error';
    res.status(500).json({ error: 'Authentication failed', details: errorMessage });
  }
}

// Usage limit middleware
async function checkUsageLimit(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Calculate required characters based on request
    let requiredCharacters = 0;
    if (req.body.text) {
      requiredCharacters = req.body.text.length;
    } else if (req.body.chapters) {
      requiredCharacters = req.body.chapters.reduce((sum: number, chapter: any) => sum + chapter.text.length, 0);
    }

    const { allowed, message } = await userService.checkUsageLimit(req.user.id, requiredCharacters);
    if (!allowed) {
      return res.status(403).json({ error: message });
    }

    next();
  } catch (error) {
    console.error('Usage check error:', error);
    res.status(500).json({ error: 'Failed to check usage limits' });
  }
}

const storageService = new StorageService();

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  throw new Error("ElevenLabs API key not configured");
}
const elevenLabsClient = new ElevenLabsClient({ apiKey });

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
  
  // Debug: Log before registering /api/voices
  console.log("Registering /api/voices route");

  // Get available voices
  app.get("/api/voices", async (_req: Request, res: Response) => {
    console.log("GET /api/voices called");
    try {
      const voices = await getVoicesUseCase();
      res.json(voices);
    } catch (error) {
      console.error("Error in /api/voices:", error);
      res.status(500).json({ error: "Failed to fetch voices" });
    }
  });

  // Get a specific ElevenLabs voice by ID
  app.get("/api/voices/:voiceId", requireAuth, async (req: Request, res: Response) => {
     try {
       const voiceId = req.params.voiceId;
       const voice = await elevenLabsClient.voices.get(voiceId);
       res.json(voice);
     } catch (error) {
       console.error("Error fetching voice:", error);
       res.status(500).json({ error: "Failed to fetch voice" });
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
  app.post("/api/text-to-speech", requireAuth, checkUsageLimit, async (req: Request, res: Response) => {
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
      console.log("Processing", parsedBody.data.chapters?.length || 1, "chapters");

      // Add job to queue
      const { jobId } = await queueService.addTTSJob(parsedBody.data, req.user!.id);
      
      // Log usage
      const characterCount = parsedBody.data.chapters?.reduce((sum, chapter) => sum + chapter.text.length, 0) || parsedBody.data.text.length;
      await userService.logUsage(req.user!.id, 'text_to_speech', characterCount);
      
      res.json({
        success: true,
        jobId,
        message: 'TTS job queued successfully'
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
      return res.status(500).json({ error: "Failed to queue TTS job" });
    }
  });

  // Get TTS job status
  app.get("/api/tts-job/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const jobId = req.params.id;
      const { data: job, error: jobError } = await supabaseAdmin
        .from('tts_jobs')
        .select('user_id')
        .eq('id', jobId)
        .single();

      if (jobError) {
        console.error("Error fetching job:", jobError);
        return res.status(500).json({ error: "Failed to fetch job details" });
      }

      if (!job || job.user_id !== req.user!.id) {
        return res.status(403).json({ error: "Unauthorized access to job" });
      }

      const jobStatus = await queueService.getJobStatus(jobId);
      
      if (!jobStatus) {
        return res.status(404).json({ error: "Job not found" });
      }

      res.json(jobStatus);
    } catch (error) {
      console.error("Error getting job status:", error);
      if (error instanceof Error) {
        return res.status(500).json({ error: error.message });
      }
      return res.status(500).json({ error: "Failed to get job status" });
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
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        return res.status(422).json({ error: "Audio file is missing or corrupted." });
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
  app.get("/audio/:filename", async (req: Request, res: Response) => {
    try {
      const key = `audio/${req.params.filename}`;
      const result = await storageService.serveFile(key);
      
      if (!result) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      res.setHeader('Content-Type', result.file.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename=${result.file.fileName}`);
      res.setHeader('Content-Length', result.file.size);
      
      // Create a readable stream from the buffer
      const bufferStream = new PassThrough();
      bufferStream.end(result.buffer);
      
      // Handle stream errors before piping
      bufferStream.on('error', (error: Error) => {
        console.error('Error streaming file:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error streaming file' });
        }
      });
      
      bufferStream.pipe(res);
    } catch (error: unknown) {
      console.error('Error serving file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to serve file' });
      }
    }
  });
  
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
        res.setHeader('Content-Length', content.length);
        
        // Send the single text file to the client
        console.log(`Sending single text file: ${fileName} (${content.length} bytes)`);
        res.send(content);
      }
    } catch (error) {
      console.error("Error serving chapter ZIP:", error);
      res.status(500).json({ error: "Failed to serve chapter ZIP" });
    }
  });

  app.get('/api/test', (_req, res) => res.json({ ok: true }));

  const httpServer = createServer(app);
  return httpServer;
}