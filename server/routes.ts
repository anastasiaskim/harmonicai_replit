import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import axios from "axios";
import { z } from "zod";
import { textToSpeechSchema } from "@shared/schema";
import * as fs from 'fs';
import * as path from 'path';
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { createHash } from 'crypto';

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
  // Get available voices
  app.get("/api/voices", async (_req: Request, res: Response) => {
    try {
      const voices = await storage.getVoices();
      res.json(voices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch voices" });
    }
  });

  // Upload text file
  app.post(
    "/api/upload",
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        if (!req.file && !req.body.text) {
          return res.status(400).json({ error: "No file or text provided" });
        }

        let text = "";
        let fileType = "direct";

        if (req.file) {
          // File upload handling
          const { originalname, buffer, mimetype } = req.file;
          
          // Check file type
          if (!(
            mimetype === "text/plain" || 
            mimetype === "application/epub+zip" || 
            mimetype === "application/pdf" ||
            originalname.endsWith(".txt") || 
            originalname.endsWith(".epub") || 
            originalname.endsWith(".pdf")
          )) {
            return res.status(400).json({ 
              error: "Invalid file type. Only TXT, EPUB, and PDF are supported." 
            });
          }

          // Parse the file content based on file type
          if (mimetype === "text/plain" || originalname.endsWith(".txt")) {
            text = buffer.toString("utf-8");
            fileType = "txt";
          } else if (mimetype === "application/pdf" || originalname.endsWith(".pdf")) {
            // For MVP, we just pretend to parse PDF but return the plain text
            text = `${originalname} content. In the production app, this would be the parsed PDF content.`;
            fileType = "pdf";
          } else if (mimetype === "application/epub+zip" || originalname.endsWith(".epub")) {
            // For MVP, we just pretend to parse EPUB but return the plain text
            text = `${originalname} content. In the production app, this would be the parsed EPUB content.`;
            fileType = "epub";
          }
        } else if (req.body.text) {
          // Direct text input
          text = req.body.text;
          fileType = "direct";
        }

        // Enforce character limit
        if (text.length > 50000) {
          text = text.substring(0, 50000);
        }

        // Update analytics
        const analytics = await storage.getAnalytics();
        if (analytics) {
          const updatedFileTypes = { ...analytics.fileTypes };
          updatedFileTypes[fileType] = (updatedFileTypes[fileType] || 0) + 1;
          
          await storage.updateAnalytics({
            totalCharacters: analytics.totalCharacters + text.length,
            fileTypes: updatedFileTypes
          });
        }

        // Simple chapter detection logic
        const chapters = detectChapters(text);

        return res.json({
          text,
          chapters,
          charCount: text.length,
        });
      } catch (error) {
        console.error("Upload error:", error);
        return res.status(500).json({ error: "Failed to process file" });
      }
    }
  );

  // Convert text to speech using ElevenLabs API
  app.post("/api/text-to-speech", async (req: Request, res: Response) => {
    try {
      // Get ElevenLabs API key from environment variables
      const apiKey = process.env.ELEVENLABS_API_KEY || "";
      if (!apiKey) {
        return res.status(500).json({ error: "ElevenLabs API key is missing" });
      }

      // Validate request
      const parsedBody = textToSpeechSchema.safeParse(req.body);
      if (!parsedBody.success) {
        const validationError = fromZodError(parsedBody.error);
        return res.status(400).json({ error: validationError.message });
      }

      const { text, voice, chapters } = parsedBody.data;

      if (chapters.length === 0) {
        return res.status(400).json({ error: "No chapters provided" });
      }

      // Get voice data
      const voiceData = await storage.getVoiceByVoiceId(voice);
      if (!voiceData) {
        return res.status(400).json({ error: "Invalid voice selection" });
      }

      // Mock ElevenLabs voice IDs for each of our voices
      const elevenLabsVoiceIds: Record<string, string> = {
        rachel: "EXAVITQu4vr4xnSDxMaL",
        thomas: "TxGEqnHWrfWFTfGW9XjX",
        emily: "D38z5RcWu1voky8WS1ja",
        james: "pNInz6obpgDQGcFmaJgB"
      };

      // Process each chapter
      const processedChapters = [];
      for (const chapter of chapters) {
        try {
          // Call ElevenLabs API
          const voiceId = elevenLabsVoiceIds[voice] || elevenLabsVoiceIds.rachel;
          
          // Create unique filename based on content hash
          const contentHash = createHash('md5').update(chapter.text).digest('hex');
          const fileName = `${voice}_${contentHash}.mp3`;
          const filePath = path.join(uploadDir, fileName);
          
          // For MVP, we're not actually calling the API to avoid needing real credentials
          // In a real implementation, you would make the API call to ElevenLabs here
          
          // Simulate API call delay
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Create a mock MP3 file (empty file for the MVP)
          fs.writeFileSync(filePath, Buffer.from(''));
          
          // Calculate a mock size based on text length (in real app, we'd get actual file size)
          const size = Math.floor(chapter.text.length / 10) * 1024; // ~0.1KB per character
          
          // Calculate a mock duration based on reading speed (in real app, we'd get actual duration)
          const wordCount = chapter.text.split(/\s+/).length;
          const durationInSeconds = Math.floor(wordCount / 3); // ~3 words per second reading speed
          
          // Add chapter to DB
          const insertedChapter = await storage.insertChapter({
            title: chapter.title,
            audioUrl: `/api/audio/${fileName}`,
            duration: durationInSeconds,
            size: size,
            createdAt: new Date().toISOString()
          });

          processedChapters.push({
            id: insertedChapter.id,
            title: insertedChapter.title,
            audioUrl: insertedChapter.audioUrl,
            duration: insertedChapter.duration,
            size: insertedChapter.size
          });
        } catch (error) {
          console.error(`Error processing chapter "${chapter.title}":`, error);
        }
      }

      // Update analytics
      const analytics = await storage.getAnalytics();
      if (analytics) {
        const voiceUsage = { ...analytics.voiceUsage };
        voiceUsage[voice] = (voiceUsage[voice] || 0) + 1;
        
        await storage.updateAnalytics({
          conversions: analytics.conversions + 1,
          voiceUsage
        });
      }

      res.json({
        success: true,
        chapters: processedChapters
      });
    } catch (error) {
      console.error("Text-to-speech conversion error:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      return res.status(500).json({ error: "Failed to generate audio" });
    }
  });

  // Serve audio files
  app.get("/api/audio/:filename", (req: Request, res: Response) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Audio file not found" });
    }
    
    // Set headers for audio streaming
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    
    // Stream the file to the client
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  });

  // Get analytics
  app.get("/api/analytics", async (_req: Request, res: Response) => {
    try {
      const analytics = await storage.getAnalytics();
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Simple chapter detection function
function detectChapters(text: string): { title: string; text: string }[] {
  // Split text into lines
  const lines = text.split('\n');
  const chapters: { title: string; text: string }[] = [];
  
  let currentChapter = '';
  let currentTitle = 'Chapter 1';
  let chapterIndex = 1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Detect if this line is a chapter title
    const isChapterTitle = 
      line.toLowerCase().startsWith('chapter') || 
      (line.length < 50 && line.length > 5 && i < lines.length / 10);
    
    if (isChapterTitle && currentChapter.length > 0) {
      // Save previous chapter
      chapters.push({
        title: currentTitle,
        text: currentChapter.trim()
      });
      
      // Start new chapter
      currentTitle = line || `Chapter ${++chapterIndex}`;
      currentChapter = '';
    } else {
      currentChapter += line + '\n';
    }
  }
  
  // Add the last chapter
  if (currentChapter.trim().length > 0) {
    chapters.push({
      title: currentTitle,
      text: currentChapter.trim()
    });
  }
  
  // If no chapters were detected, treat the entire text as one chapter
  if (chapters.length === 0 && text.trim().length > 0) {
    chapters.push({
      title: 'Chapter 1',
      text: text.trim()
    });
  }
  
  return chapters;
}
