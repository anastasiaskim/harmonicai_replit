import { 
  voices, type Voice, type InsertVoice,
  analytics, type Analytics, type InsertAnalytics,
  chapters, type Chapter, type InsertChapter
} from "@shared/schema";

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

export class MemStorage implements IStorage {
  private voicesData: Map<number, Voice>;
  private analyticsData: Analytics | undefined;
  private chaptersData: Map<number, Chapter>;
  private voiceIdCounter: number;
  private analyticsIdCounter: number;
  private chapterIdCounter: number;

  constructor() {
    this.voicesData = new Map();
    this.chaptersData = new Map();
    this.voiceIdCounter = 1;
    this.analyticsIdCounter = 1;
    this.chapterIdCounter = 1;
    
    // Initialize with default voices
    this.insertVoice({
      voiceId: "rachel",
      name: "Rachel",
      description: "Warm, natural female voice with clear enunciation"
    });
    
    this.insertVoice({
      voiceId: "thomas",
      name: "Thomas",
      description: "Deep, authoritative male voice for non-fiction"
    });
    
    this.insertVoice({
      voiceId: "emily",
      name: "Emily",
      description: "Soft, expressive voice ideal for fiction"
    });
    
    this.insertVoice({
      voiceId: "james",
      name: "James",
      description: "British accent with rich tone for narratives"
    });
    
    // Initialize analytics
    this.updateAnalytics({
      fileUploads: 0,
      textInputs: 0,
      conversions: 0,
      characterCount: 0,
      fileTypes: { txt: 0, epub: 0, pdf: 0, direct: 0 },
      voiceUsage: {},
      createdAt: new Date().toISOString()
    });
  }

  // Voice operations
  async getVoices(): Promise<Voice[]> {
    return Array.from(this.voicesData.values());
  }

  async getVoice(id: number): Promise<Voice | undefined> {
    return this.voicesData.get(id);
  }

  async getVoiceByVoiceId(voiceId: string): Promise<Voice | undefined> {
    return Array.from(this.voicesData.values()).find(
      (voice) => voice.voiceId === voiceId
    );
  }

  async insertVoice(voice: InsertVoice): Promise<Voice> {
    const id = this.voiceIdCounter++;
    const newVoice: Voice = { id, ...voice };
    this.voicesData.set(id, newVoice);
    return newVoice;
  }
  
  // Analytics operations
  async getAnalytics(): Promise<Analytics | undefined> {
    return this.analyticsData;
  }

  async updateAnalytics(data: Partial<InsertAnalytics>): Promise<Analytics> {
    if (!this.analyticsData) {
      // Initialize new analytics record
      const id = this.analyticsIdCounter++;
      this.analyticsData = { 
        id, 
        fileUploads: data.fileUploads || 0,
        textInputs: data.textInputs || 0,
        conversions: data.conversions || 0,
        characterCount: data.characterCount || 0,
        fileTypes: data.fileTypes || { txt: 0, epub: 0, pdf: 0, direct: 0 },
        voiceUsage: data.voiceUsage || {},
        createdAt: data.createdAt || new Date().toISOString()
      };
    } else {
      // Update existing analytics record with type safety
      const existingData = this.analyticsData;
      this.analyticsData = { 
        ...existingData,
        fileUploads: data.fileUploads !== undefined ? data.fileUploads : existingData.fileUploads,
        textInputs: data.textInputs !== undefined ? data.textInputs : existingData.textInputs,
        conversions: data.conversions !== undefined ? data.conversions : existingData.conversions,
        characterCount: data.characterCount !== undefined ? data.characterCount : existingData.characterCount,
        fileTypes: data.fileTypes || existingData.fileTypes,
        voiceUsage: data.voiceUsage ? { ...existingData.voiceUsage as Record<string, number>, ...data.voiceUsage as Record<string, number> } : existingData.voiceUsage
      };
    }
    return this.analyticsData;
  }
  
  // Chapter operations
  async getChapter(id: number): Promise<Chapter | undefined> {
    return this.chaptersData.get(id);
  }

  async getChapters(): Promise<Chapter[]> {
    return Array.from(this.chaptersData.values());
  }

  async insertChapter(chapter: InsertChapter): Promise<Chapter> {
    const id = this.chapterIdCounter++;
    const newChapter: Chapter = { id, ...chapter };
    this.chaptersData.set(id, newChapter);
    return newChapter;
  }
  
  async insertChapters(chapters: InsertChapter[]): Promise<Chapter[]> {
    return Promise.all(chapters.map(chapter => this.insertChapter(chapter)));
  }
}

export const storage = new MemStorage();
