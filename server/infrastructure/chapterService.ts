/**
 * Infrastructure Layer: Chapter Service
 * Handles chapter detection and processing functionality
 */

export interface ChapterDTO {
  title: string;
  text: string;
}

export interface ChunkingResultDTO {
  chapters: ChapterDTO[];
  wasChunked: boolean;
  originalText: string;
  patternMatchCounts: Record<string, number>;
}

class ChapterService {
  /**
   * Detect chapters in text content
   */
  detectChapters(text: string): ChapterDTO[] {
    return this.detectChaptersDetailed(text).chapters;
  }
  
  /**
   * Detect chapters in text content with detailed information about the chunking process
   * @param text The text content to analyze
   * @param minChapters Minimum number of chapters needed to consider chunking successful
   * @returns A ChunkingResultDTO object with chapters and metadata
   */
  detectChaptersDetailed(text: string, minChapters: number = 1): ChunkingResultDTO {
    if (!text || typeof text !== 'string') {
      return {
        chapters: [],
        wasChunked: false,
        originalText: text || '',
        patternMatchCounts: {}
      };
    }

    // Common chapter markers (ordered by likelihood)
    const chapterMarkers = [
      /chapter\s+(\d+|[ivxlcdm]+)(?:\s*:\s*(.+))?/i,   // "Chapter 1: Title" or "Chapter One"
      /\bchapter\s+(\d+|[ivxlcdm]+)\b/i,                // Simpler chapter pattern
      /^(\d+|[ivxlcdm]+)\.\s+(.+)/i,                   // "1. Chapter Title" format
      /part\s+(\d+|[ivxlcdm]+)(?:\s*:\s*(.+))?/i,      // "Part 1: Title"
      /section\s+(\d+|[ivxlcdm]+)(?:\s*:\s*(.+))?/i,   // "Section 1: Title"
      /book\s+(\d+|[ivxlcdm]+)(?:\s*:\s*(.+))?/i,      // "Book 1: Title"
      /^\s*([IVXLCDM]+)\s*$/,                          // Roman numerals on their own line
      /^\s*(\d+)\s*$/,                                 // Just digits on their own line
      /^\s*[\*\-\—\–]\s*(.+)$/                         // Dash or star prefixes like "* Chapter Title"
    ];

    // Track pattern matches for analytics
    const patternMatchCounts: Record<string, number> = {};
    
    // Split text into lines
    const lines = text.split(/\r?\n/);
    const chapters: ChapterDTO[] = [];
    let currentChapterLines: string[] = [];
    let currentChapterTitle = 'Introduction';

    // Helper to add the current chapter when a new one is detected
    const addCurrentChapter = () => {
      if (currentChapterLines.length > 0) {
        const chapterText = currentChapterLines.join('\n').trim();
        if (chapterText) {
          chapters.push({
            title: currentChapterTitle,
            text: chapterText
          });
        }
        currentChapterLines = [];
      }
    };

    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines at the start
      if (chapters.length === 0 && currentChapterLines.length === 0 && !line) {
        continue;
      }

      // Check if line matches a chapter marker
      let isChapterHeading = false;
      let patternName = '';
      
      for (let j = 0; j < chapterMarkers.length; j++) {
        const marker = chapterMarkers[j];
        if (marker.test(line)) {
          isChapterHeading = true;
          patternName = `pattern-${j}`;
          
          // Count pattern matches
          patternMatchCounts[patternName] = (patternMatchCounts[patternName] || 0) + 1;
          
          // Add current chapter to the list
          addCurrentChapter();
          
          // Start a new chapter
          currentChapterTitle = line;
          
          // Look ahead for possible title continuation
          let nextIndex = i + 1;
          if (nextIndex < lines.length) {
            const nextLine = lines[nextIndex].trim();
            if (nextLine && !chapterMarkers.some(m => m.test(nextLine))) {
              currentChapterTitle = `${line}\n${nextLine}`;
              i++; // Skip the title line in the next iteration
            }
          }
          
          break;
        }
      }

      // Try heuristic detection for chapter headings
      if (!isChapterHeading) {
        // ALL CAPS line that's relatively short might be a heading
        if (line.length > 2 && line.length < 50 && 
            line === line.toUpperCase() && 
            line !== line.toLowerCase()) {
            
          // Consider this a chapter heading if not at the very beginning
          if (chapters.length > 0 || currentChapterLines.length > 10) {
            isChapterHeading = true;
            patternName = 'heuristic-caps';
            
            // Count pattern matches
            patternMatchCounts[patternName] = (patternMatchCounts[patternName] || 0) + 1;
            
            // Add current chapter to the list
            addCurrentChapter();
            
            // Start a new chapter
            currentChapterTitle = line;
          }
        }
        
        // Short standalone line surrounded by blank lines might be a heading
        const isPreviousLineBlank = i === 0 || !lines[i-1].trim();
        const isNextLineBlank = i === lines.length-1 || !lines[i+1].trim();
        
        if (!isChapterHeading && line.length > 2 && line.length < 40 && 
            isPreviousLineBlank && isNextLineBlank) {
            
          // Only consider this a chapter if we've already seen some content
          if (chapters.length > 0 || currentChapterLines.length > 10) {
            isChapterHeading = true;
            patternName = 'heuristic-isolated';
            
            // Count pattern matches
            patternMatchCounts[patternName] = (patternMatchCounts[patternName] || 0) + 1;
            
            // Add current chapter to the list
            addCurrentChapter();
            
            // Start a new chapter
            currentChapterTitle = line;
          }
        }
      }

      // If not a chapter heading, add to current chapter text
      if (!isChapterHeading) {
        currentChapterLines.push(line);
      }
    }

    // Add the last chapter
    addCurrentChapter();

    // If no chapters detected, treat the entire text as one chapter
    if (chapters.length === 0 && text.trim()) {
      chapters.push({
        title: 'Chapter 1',
        text: text.trim()
      });
    }
    
    // We consider chunking successful if we found at least minChapters chapters
    const wasChunked = chapters.length >= minChapters;
    
    console.log(`Detected ${chapters.length} chapters in text`);
    console.log(`Chunking successful?: ${wasChunked}`);
    console.log(`Pattern match counts:`, patternMatchCounts);

    return {
      chapters,
      wasChunked,
      originalText: text,
      patternMatchCounts
    };
  }

  /**
   * Estimates reading time for a chapter based on word count
   */
  estimateReadingTime(text: string, wordsPerMinute = 150): number {
    if (!text) return 0;
    
    const wordCount = text.split(/\s+/).filter(word => word).length;
    const minutes = wordCount / wordsPerMinute;
    return Math.ceil(minutes * 60); // Convert to seconds
  }

  /**
   * Estimates file size for audio based on text length
   */
  estimateAudioSize(text: string): number {
    if (!text) return 0;
    
    // Rough estimate: ~1 KB per 6 seconds of audio at 128 kbps
    const secondsOfAudio = this.estimateReadingTime(text);
    return Math.ceil(secondsOfAudio / 6) * 1024; // Size in bytes
  }
}

export const chapterService = new ChapterService();