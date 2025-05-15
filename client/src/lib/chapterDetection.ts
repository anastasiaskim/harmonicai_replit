/**
 * Chapter Detection Utility
 * 
 * Provides helper functions for chapter detection and text processing.
 */

/**
 * Represents a chapter with title and text content
 */
export interface Chapter {
  title: string;
  text: string;
}

/**
 * Result of chapter chunking operation
 */
export interface ChunkingResult {
  chapters: Chapter[];
  wasChunked: boolean;
  aiDetection: boolean;
  confidenceLevels?: Record<string, number>;
}

/**
 * Estimates reading time for text in minutes
 * 
 * @param text Text content to estimate reading time for
 * @returns Estimated reading time in minutes
 */
export function estimateReadingTime(text: string): number {
  // Average adult reading speed is around 250 words per minute
  const words = text.split(/\s+/).length;
  return Math.ceil(words / 250);
}

/**
 * Estimates audio size in KB based on text length
 * 
 * @param text Text content to estimate audio size for
 * @returns Estimated audio size in KB
 */
export function estimateAudioSize(text: string): number {
  // Very rough estimate: ~10 bytes per character for voice audio
  return Math.ceil((text.length * 10) / 1024);
}

/**
 * Gets the word count of text
 * 
 * @param text Text to count words in
 * @returns Number of words
 */
export function getWordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Safely extracts a preview of text with specified length
 * 
 * @param text Text to extract preview from
 * @param maxLength Maximum length of preview
 * @returns Truncated text with ellipsis if needed
 */
export function getTextPreview(text: string, maxLength: number = 200): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  // Find a good breakpoint (end of sentence or paragraph)
  const goodBreakpoints = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
  
  // Look for a good breakpoint within the range
  const searchEnd = Math.min(text.length, maxLength + 50);
  let breakIndex = -1;
  
  for (const breakpoint of goodBreakpoints) {
    const index = text.lastIndexOf(breakpoint, searchEnd);
    if (index > breakIndex && index < maxLength) {
      breakIndex = index + breakpoint.length;
    }
  }
  
  // If no good breakpoint, just cut at maxLength
  if (breakIndex === -1 || breakIndex < maxLength * 0.5) {
    breakIndex = maxLength;
  }
  
  return text.substring(0, breakIndex) + (text.length > breakIndex ? '...' : '');
}

/**
 * Attempts to extract a book title from the text content
 * 
 * @param text Text content to analyze for title
 * @param chapters Optional array of chapters to analyze
 * @returns Extracted title or a default title
 */
export function extractBookTitle(text: string, chapters?: Chapter[]): string {
  // Try to extract title from the first few lines of text
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  
  // If the first line is a title-like format, use it (short and prominent)
  if (lines.length > 0 && lines[0].length < 100 && lines[0].trim().length > 0) {
    const firstLine = lines[0].trim();
    
    // Check if it looks like a title (not starting with common non-title patterns)
    const nonTitlePatterns = [
      /^chapter\s+\d+/i,
      /^part\s+\d+/i,
      /^section\s+\d+/i,
      /^introduction/i,
      /^preface/i,
      /^foreword/i,
      /^acknowledgements/i,
      /^table\s+of\s+contents/i,
      /^copyright/i
    ];
    
    const isNotTitle = nonTitlePatterns.some(pattern => pattern.test(firstLine));
    
    if (!isNotTitle) {
      return firstLine;
    }
  }
  
  // If chapters are provided, try to extract a common prefix
  if (chapters && chapters.length >= 2) {
    // Get chapter titles
    const titles = chapters.map(chapter => chapter.title);
    
    // Look for books with "Chapter X: Book Title - Chapter Title" pattern
    const bookTitlePattern = /Chapter\s+\d+\s*[:-]\s*([^-:]+)(?:\s*[-:]\s*.+)?/i;
    
    for (const title of titles) {
      const match = title.match(bookTitlePattern);
      if (match && match[1] && match[1].trim().length > 0) {
        return match[1].trim();
      }
    }
  }
  
  // If all else fails, return a generic title
  return "My Audiobook";
}