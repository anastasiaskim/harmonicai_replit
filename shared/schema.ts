import { pgTable, text, serial, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Voice schema for ElevenLabs voices
export const voices = pgTable("voices", {
  id: serial("id").primaryKey(),
  voiceId: text("voice_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
});

// Store analytics data
export const analytics = pgTable("analytics", {
  id: serial("id").primaryKey(),
  fileUploads: integer("file_uploads").default(0),
  textInputs: integer("text_inputs").default(0),
  conversions: integer("conversions").default(0),
  characterCount: integer("character_count").default(0),
  fileTypes: jsonb("file_types").default({}).notNull(),
  voiceUsage: jsonb("voice_usage").default({}).notNull(),
  createdAt: text("created_at").notNull(),
});

// Audiobook chapters
export const chapters = pgTable("chapters", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  audioUrl: text("audio_url").notNull(),
  duration: integer("duration").notNull(),
  size: integer("size").notNull(),
  createdAt: text("created_at").notNull(),
});

// Insert schemas
export const insertVoiceSchema = createInsertSchema(voices).pick({
  voiceId: true,
  name: true,
  description: true,
});

export const insertAnalyticsSchema = createInsertSchema(analytics).pick({
  fileUploads: true,
  textInputs: true,
  conversions: true,
  characterCount: true,
  fileTypes: true,
  voiceUsage: true,
  createdAt: true,
});

export const insertChapterSchema = createInsertSchema(chapters).pick({
  title: true,
  audioUrl: true,
  duration: true,
  size: true,
  createdAt: true,
});

// Types
export type InsertVoice = z.infer<typeof insertVoiceSchema>;
export type InsertAnalytics = z.infer<typeof insertAnalyticsSchema>;
export type InsertChapter = z.infer<typeof insertChapterSchema>;
export type Voice = typeof voices.$inferSelect;
export type Analytics = typeof analytics.$inferSelect;
export type Chapter = typeof chapters.$inferSelect;

// Request validation schemas
export const textToSpeechSchema = z.object({
  text: z.string(), // Removed the max limit since we're handling chunking
  voice: z.string(),
  chapters: z.array(z.object({
    title: z.string(),
    text: z.string(), // The text chunking in audioService will handle large texts
  })),
});

export type TextToSpeechRequest = z.infer<typeof textToSpeechSchema>;
