import { 
  voices, type Voice, type InsertVoice,
  analytics, type Analytics, type InsertAnalytics,
  chapters, type Chapter, type InsertChapter
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Voice operations
  getVoices(): Promise<Voice[]>;
  getVoice(id: number): Promise<Voice | undefined>;
  getVoiceByVoiceId(voiceId: string): Promise<Voice | undefined>;
  insertVoice(voice: InsertVoice): Promise<Voice>;
  
  // Analytics operations
  getAnalytics(): Promise<Analytics | undefined>;
  updateAnalytics(data: Partial<InsertAnalytics>): Promise<Analytics>;
  
  // Chapter operations
  getChapter(id: number): Promise<Chapter | undefined>;
  getChapters(): Promise<Chapter[]>;
  insertChapter(chapter: InsertChapter): Promise<Chapter>;
  insertChapters(chapters: InsertChapter[]): Promise<Chapter[]>;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    // Initialize default voices and analytics if they don't exist
    this.initializeDefaults();
  }

  private async initializeDefaults() {
    // Check if voices exist
    const existingVoices = await db.select().from(voices);
    if (existingVoices.length === 0) {
      // Add default voices
      await db.insert(voices).values([
        {
          voiceId: "rachel",
          name: "Rachel",
          description: "Warm, natural female voice with clear enunciation"
        },
        {
          voiceId: "thomas",
          name: "Thomas",
          description: "Deep, authoritative male voice for non-fiction"
        },
        {
          voiceId: "emily",
          name: "Emily",
          description: "Soft, expressive voice ideal for fiction"
        },
        {
          voiceId: "james",
          name: "James",
          description: "British accent with rich tone for narratives"
        }
      ]);
    }

    // Check if analytics exist
    const existingAnalytics = await db.select().from(analytics);
    if (existingAnalytics.length === 0) {
      // Initialize analytics
      await db.insert(analytics).values({
        conversions: 0,
        totalCharacters: 0,
        fileTypes: { txt: 0, epub: 0, pdf: 0, direct: 0 },
        voiceUsage: {},
        createdAt: new Date().toISOString()
      });
    }
  }

  // Voice operations
  async getVoices(): Promise<Voice[]> {
    return await db.select().from(voices);
  }

  async getVoice(id: number): Promise<Voice | undefined> {
    const result = await db.select().from(voices).where(eq(voices.id, id));
    return result[0];
  }

  async getVoiceByVoiceId(voiceId: string): Promise<Voice | undefined> {
    const result = await db.select().from(voices).where(eq(voices.voiceId, voiceId));
    return result[0];
  }

  async insertVoice(voice: InsertVoice): Promise<Voice> {
    const result = await db.insert(voices).values(voice).returning();
    return result[0];
  }
  
  // Analytics operations
  async getAnalytics(): Promise<Analytics | undefined> {
    const result = await db.select().from(analytics).orderBy(desc(analytics.id)).limit(1);
    return result[0];
  }

  async updateAnalytics(data: Partial<InsertAnalytics>): Promise<Analytics> {
    const currentAnalytics = await this.getAnalytics();
    
    if (!currentAnalytics) {
      // If no analytics exist, create a new one
      const result = await db.insert(analytics).values({
        conversions: data.conversions || 0,
        totalCharacters: data.totalCharacters || 0,
        fileTypes: data.fileTypes || { txt: 0, epub: 0, pdf: 0, direct: 0 },
        voiceUsage: data.voiceUsage || {},
        createdAt: data.createdAt || new Date().toISOString()
      }).returning();
      
      return result[0];
    } else {
      // Update existing analytics
      const updatedAnalytics = {
        ...currentAnalytics,
        conversions: data.conversions !== undefined ? data.conversions : currentAnalytics.conversions,
        totalCharacters: data.totalCharacters !== undefined ? data.totalCharacters : currentAnalytics.totalCharacters,
        fileTypes: data.fileTypes || currentAnalytics.fileTypes,
        voiceUsage: data.voiceUsage ? { ...currentAnalytics.voiceUsage, ...data.voiceUsage } : currentAnalytics.voiceUsage
      };
      
      const result = await db.update(analytics)
        .set(updatedAnalytics)
        .where(eq(analytics.id, currentAnalytics.id))
        .returning();
        
      return result[0];
    }
  }
  
  // Chapter operations
  async getChapter(id: number): Promise<Chapter | undefined> {
    const result = await db.select().from(chapters).where(eq(chapters.id, id));
    return result[0];
  }

  async getChapters(): Promise<Chapter[]> {
    return await db.select().from(chapters);
  }

  async insertChapter(chapter: InsertChapter): Promise<Chapter> {
    const result = await db.insert(chapters).values(chapter).returning();
    return result[0];
  }
  
  async insertChapters(chapters: InsertChapter[]): Promise<Chapter[]> {
    if (chapters.length === 0) return [];
    const result = await db.insert(chapters).values(chapters).returning();
    return result;
  }
}

export const storage = new DatabaseStorage();
