/**
 * Utility functions for chapter detection in text content
 */

/**
 * Detects chapters in text content
 * 
 * @param text The full text content to analyze
 * @returns An array of chapter objects with title and text
 */
export interface Chapter {
  title: string;
  text: string;
}

/**
 * Common patterns for chapter headings in ebooks
 */
const CHAPTER_PATTERNS = [
  // Pattern for "Chapter X" or "Chapter X:" or "CHAPTER X" etc.
  /^\s*(chapter|CHAPTER)\s+(\d+|[IVXLCivxlc]+)[\s:.]*(.*)$/,
  
  // Pattern for just roman numerals as chapter markers: "I", "II", "III", etc.
  /^\s*([IVXLCivxlc]+)\s*$/,
  
  // Pattern for just numbers as chapter markers: "1", "2", "3", etc.
  /^\s*(\d+)\s*$/,
  
  // Pattern for 'Part X' headings
  /^\s*(part|PART)\s+(\d+|[IVXLCivxlc]+)[\s:.]*(.*)$/,
  
  // Pattern for common chapter title formats with non-numeric identifiers
  /^\s*(prologue|epilogue|introduction|foreword|preface|afterword|conclusion|appendix|INDEX|CONTENTS)/i
];

/**
 * Checks if a line matches any of the chapter heading patterns
 */
const isChapterHeading = (line: string): boolean => {
  // Skip empty lines
  if (line.trim().length === 0) return false;
  
  // Check against each pattern
  for (const pattern of CHAPTER_PATTERNS) {
    if (pattern.test(line)) return true;
  }
  
  // Additional heuristic checks:
  // 1. Short lines (likely titles) that are surrounded by blank lines
  // 2. ALL CAPS lines that are relatively short (potential section markers)
  // 3. Lines that end with particular punctuation patterns
  
  // Short standalone line (potential title)
  if (line.length > 3 && line.length < 60) {
    // If the line is all caps or has special formatting, it's more likely a chapter heading
    if (line === line.toUpperCase() && line !== line.toLowerCase()) return true;
    
    // If the line ends with a colon, it might be a chapter heading
    if (line.endsWith(':')) return true;
  }
  
  return false;
};

/**
 * Extracts a clean chapter title from a heading line
 */
const extractChapterTitle = (line: string, index: number): string => {
  // Try to match against standard chapter patterns first
  for (const pattern of CHAPTER_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      // For "Chapter X" pattern, use the full match unless there's additional title text
      if (match[1]?.toLowerCase() === 'chapter' || match[1]?.toLowerCase() === 'part') {
        const chapterNum = match[2] || index;
        const additionalTitle = match[3]?.trim();
        
        if (additionalTitle) {
          return `${match[1]} ${chapterNum}: ${additionalTitle}`;
        } else {
          return `${match[1]} ${chapterNum}`;
        }
      }
      
      // For Roman numeral or numeric-only matches, prefix with "Chapter"
      if (/^[IVXLCivxlc]+$/.test(match[1]) || /^\d+$/.test(match[1])) {
        return `Chapter ${match[1]}`;
      }
      
      // For known section types (prologue, epilogue, etc.), use as is
      return line.trim();
    }
  }
  
  // If no pattern matched but we still think it's a heading, use as is or default
  return line.trim() || `Chapter ${index}`;
};

/**
 * Improved chapter detection algorithm with configurable patterns
 */
export const detectChapters = (text: string): Chapter[] => {
  // Split text into lines while preserving line breaks
  const lines = text.split('\n');
  const chapters: Chapter[] = [];
  
  let currentChapter = '';
  let currentTitle = '';
  let chapterIndex = 1;
  let inChapter = false;
  
  // Find the first chapter heading
  for (let i = 0; i < Math.min(50, lines.length); i++) {
    if (isChapterHeading(lines[i])) {
      currentTitle = extractChapterTitle(lines[i], chapterIndex);
      inChapter = true;
      // Skip this line as it's the title
      continue;
    }
    
    // If we've found a chapter title, start collecting text
    if (inChapter) {
      currentChapter += lines[i] + '\n';
    }
  }
  
  // If no chapter heading was found in the first 50 lines, use default title
  if (!inChapter) {
    currentTitle = 'Chapter 1';
    inChapter = true;
    
    // Include all content from the beginning
    for (let i = 0; i < Math.min(50, lines.length); i++) {
      currentChapter += lines[i] + '\n';
    }
  }
  
  // Process the rest of the content
  for (let i = 50; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if this line could be a new chapter heading
    if (isChapterHeading(line)) {
      // Save the current chapter
      if (currentChapter.trim().length > 0) {
        chapters.push({
          title: currentTitle,
          text: currentChapter.trim()
        });
      }
      
      // Start a new chapter
      chapterIndex++;
      currentTitle = extractChapterTitle(line, chapterIndex);
      currentChapter = '';
    } else {
      // Add this line to the current chapter content
      currentChapter += line + '\n';
    }
  }
  
  // Add the last chapter if it has content
  if (currentChapter.trim().length > 0) {
    chapters.push({
      title: currentTitle,
      text: currentChapter.trim()
    });
  }
  
  // If no chapters were detected at all, treat the entire text as one chapter
  if (chapters.length === 0 && text.trim().length > 0) {
    chapters.push({
      title: 'Chapter 1',
      text: text.trim()
    });
  }
  
  console.log(`Detected ${chapters.length} chapters in the text`);
  return chapters;
};

/**
 * Estimates reading time for a chapter based on word count
 * 
 * @param text The chapter text
 * @param wordsPerMinute Reading speed (default: 150 words per minute)
 * @returns Estimated reading time in seconds
 */
export const estimateReadingTime = (text: string, wordsPerMinute = 150): number => {
  const wordCount = text.split(/\s+/).length;
  const minutes = wordCount / wordsPerMinute;
  return Math.round(minutes * 60); // Convert to seconds
};

/**
 * Estimates file size for audio based on text length
 * Simple estimation formula for MVP - in a real app, this would be more sophisticated
 * 
 * @param text The text content
 * @returns Estimated size in bytes
 */
export const estimateAudioSize = (text: string): number => {
  const charCount = text.length;
  // Rough estimate: ~12 bytes per character in MP3 format (varies by voice, speech rate, etc.)
  return charCount * 12;
};

/**
 * Extracts a potential book title from the text content
 * Uses heuristics to find a line that looks like it could be a title
 * 
 * @param text The full text content
 * @returns The extracted book title or a default title
 */
export const extractBookTitle = (text: string): string => {
  if (!text || text.trim().length === 0) {
    return 'Untitled Book';
  }

  const lines = text.split('\n');
  
  // Search through the first 20 lines for potential title candidates
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (line.length === 0) continue;
    
    // Look for short lines that might be titles
    if (line.length > 2 && line.length < 70) {
      // Check for lines that are in ALL CAPS (common for titles)
      if (line === line.toUpperCase() && line !== line.toLowerCase()) {
        return line;
      }
      
      // If we're still in the first few lines and the line doesn't look like
      // a chapter heading, it might be a title
      if (i < 5 && !isChapterHeading(line)) {
        return line;
      }
    }
  }
  
  // If we couldn't find a good title candidate, try to get one from the first chapter
  const chapters = detectChapters(text);
  if (chapters.length > 0) {
    const firstChapterTitle = chapters[0].title;
    if (firstChapterTitle.toLowerCase().includes('chapter')) {
      return 'Untitled Book';
    }
    return firstChapterTitle;
  }
  
  // Default fallback
  return 'Untitled Book';
};
