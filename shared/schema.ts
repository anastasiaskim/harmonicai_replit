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

// TTS Jobs table
export const ttsJobs = pgTable("tts_jobs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text("status").notNull(), // pending, processing, completed, failed, cancelled
  audioUrls: jsonb("audio_urls").default([]), // Array of audio URLs
  error: text("error"),
  progress: integer("progress").default(0), // 0-100
  totalChapters: integer("total_chapters").default(1),
  processedChapters: integer("processed_chapters").default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// User schema
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Supabase Auth user ID
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  subscriptionTier: text("subscription_tier").default('free'), // free, pro, enterprise
  usageQuota: integer("usage_quota").default(1000), // Character limit per month
  usageCount: integer("usage_count").default(0), // Current month's usage
  lastUsageReset: text("last_usage_reset").notNull(), // ISO date string
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Usage tracking schema
export const usageLogs = pgTable("usage_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  action: text("action").notNull(), // text_to_speech, file_upload, etc.
  characterCount: integer("character_count").default(0),
  fileSize: integer("file_size").default(0),
  metadata: jsonb("metadata").default({}),
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

export const insertTTSJobSchema = createInsertSchema(ttsJobs).pick({
  userId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  audioUrls: z.array(z.string()).optional(),
  error: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
  totalChapters: z.number().optional(),
  processedChapters: z.number().optional(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  fullName: true,
  avatarUrl: true,
  subscriptionTier: true,
  usageQuota: true,
  usageCount: true,
  lastUsageReset: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUsageLogSchema = createInsertSchema(usageLogs).pick({
  userId: true,
  action: true,
  characterCount: true,
  fileSize: true,
  metadata: true,
  createdAt: true,
});

// Types
export type InsertVoice = z.infer<typeof insertVoiceSchema>;
export type InsertAnalytics = z.infer<typeof insertAnalyticsSchema>;
export type InsertChapter = z.infer<typeof insertChapterSchema>;
export type InsertTTSJob = z.infer<typeof insertTTSJobSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertUsageLog = z.infer<typeof insertUsageLogSchema>;
export type Voice = typeof voices.$inferSelect;
export type Analytics = typeof analytics.$inferSelect;
export type Chapter = typeof chapters.$inferSelect;
export type TTSJob = typeof ttsJobs.$inferSelect;
export type User = typeof users.$inferSelect;
export type UsageLog = typeof usageLogs.$inferSelect;

// Request validation schemas
export const textToSpeechSchema = z.object({
  text: z.string(),
  voiceId: z.string(),
  title: z.string(),
  chapters: z.array(z.object({
    title: z.string(),
    text: z.string()
  })).optional()
});

export type TextToSpeechRequest = z.infer<typeof textToSpeechSchema>;

// Database schema types
export type Database = {
  public: {
    Tables: {
      users: {
        Row: z.infer<typeof userSchema>;
        Insert: Omit<z.infer<typeof userSchema>, 'id' | 'createdAt' | 'updatedAt'>;
        Update: Partial<Omit<z.infer<typeof userSchema>, 'id'>>;
      };
      chapters: {
        Row: z.infer<typeof chapterSchema>;
        Insert: Omit<z.infer<typeof chapterSchema>, 'id' | 'createdAt' | 'updatedAt'>;
        Update: Partial<Omit<z.infer<typeof chapterSchema>, 'id'>>;
      };
      voices: {
        Row: z.infer<typeof voiceSchema>;
        Insert: Omit<z.infer<typeof voiceSchema>, 'id' | 'createdAt' | 'updatedAt'>;
        Update: Partial<Omit<z.infer<typeof voiceSchema>, 'id'>>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
};

// Zod schemas for validation
export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  fullName: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  subscriptionTier: z.string().default('free'),
  usageQuota: z.number().default(1000),
  usageCount: z.number().default(0),
  lastUsageReset: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const chapterSchema = z.object({
  id: z.number(),
  title: z.string(),
  audioUrl: z.string().url(),
  duration: z.number(),
  size: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const voiceSchema = z.object({
  id: z.number(),
  voiceId: z.string(),
  name: z.string(),
  description: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

// Request/Response types
export interface TextToSpeechResponse {
  audioUrl: string;
  duration: number;
  size: number;
}

// Auth types
export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthResponse {
  user: AuthUser | null;
  error: Error | null;
}

export const ttsJobStatusSchema = z.object({
  status: z.enum(["pending", "processing", "completed", "failed", "cancelled"]),
  audioUrls: z.array(z.string().url()).optional(),
  error: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
  totalChapters: z.number().optional(),
  processedChapters: z.number().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TTSJobStatus = z.infer<typeof ttsJobStatusSchema>;

// Subscription tiers and their limits
export const SUBSCRIPTION_TIERS = {
  FREE: {
    name: 'free',
    characterLimit: 1000,
    fileSizeLimit: 5 * 1024 * 1024, // 5MB
    maxChapters: 1,
  },
  PRO: {
    name: 'pro',
    characterLimit: 10000,
    fileSizeLimit: 50 * 1024 * 1024, // 50MB
    maxChapters: 10,
  },
  ENTERPRISE: {
    name: 'enterprise',
    characterLimit: 100000,
    fileSizeLimit: 500 * 1024 * 1024, // 500MB
    maxChapters: 100,
  },
} as const;
