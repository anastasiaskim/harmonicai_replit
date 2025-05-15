/**
 * Infrastructure Layer: Chapter Service
 * Handles chapter detection and processing functionality
 */
import { Chapter } from '@shared/schema';

export interface ChapterDTO {
  title: string;
  text: string;
}

class ChapterService {
  /**
   * Detect chapters in text content
   */
  detectChapters(text: string): ChapterDTO[] {
    // Split text into lines
    const lines = text.split('\n');
    const chapters: ChapterDTO[] = [];
    
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

  /**
   * Estimates reading time for a chapter based on word count
   */
  estimateReadingTime(text: string, wordsPerMinute = 150): number {
    const wordCount = text.split(/\s+/).length;
    const minutes = wordCount / wordsPerMinute;
    return Math.round(minutes * 60); // Convert to seconds
  }

  /**
   * Estimates file size for audio based on text length
   */
  estimateAudioSize(text: string): number {
    const charCount = text.length;
    // Rough estimate: ~12 bytes per character in MP3 format (varies by voice, speech rate, etc.)
    return Math.floor(charCount / 10) * 1024; // ~0.1KB per character
  }
}

export const chapterService = new ChapterService();