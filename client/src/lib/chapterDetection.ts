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
 * These can be extended or modified to accommodate different book formats
 */
export const CHAPTER_PATTERNS = [
  // Pattern for "Chapter X" or "Chapter X:" or "CHAPTER X" etc.
  /^\s*(chapter|CHAPTER)\s+(\d+|[IVXLCivxlc]+)[\s:.]*(.*)$/,
  
  // Pattern for just roman numerals as chapter markers: "I", "II", "III", etc.
  /^\s*([IVXLCivxlc]+)\s*$/,
  
  // Pattern for just numbers as chapter markers: "1", "2", "3", etc.
  /^\s*(\d+)\s*$/,
  
  // Pattern for 'Part X' headings
  /^\s*(part|PART)\s+(\d+|[IVXLCivxlc]+)[\s:.]*(.*)$/,
  
  // Pattern for 'Section X' headings
  /^\s*(section|SECTION)\s+(\d+|[IVXLCivxlc]+)[\s:.]*(.*)$/,
  
  // Pattern for common chapter title formats with non-numeric identifiers
  /^\s*(prologue|epilogue|introduction|foreword|preface|afterword|conclusion|appendix|INDEX|CONTENTS)/i,
  
  // Pattern for chapter titles with dash or star prefixes
  /^\s*[\*\-\—\–]\s*(.+)$/,
  
  // Pattern for numbered chapters without the word "Chapter"
  /^\s*(\d+)\.\s+(.+)$/
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
 * This function uses the chunkByChapter utility for better organization and reusability
 * 
 * @param text The full text content to analyze
 * @param customPatterns Optional additional patterns to use for detection
 * @param minChapters Minimum number of chapters expected (default is 2)
 * @returns An array of chapter objects with title and text
 */
export const detectChapters = (
  text: string, 
  customPatterns?: RegExp[],
  minChapters: number = 2
): Chapter[] => {
  // Simply delegate to our comprehensive chunking utility and return just the chapters
  const result = chunkByChapter(text, customPatterns, minChapters);
  return result.chapters;
};

/**
 * Enhanced chapter detection that returns detailed information about the chunking process
 * 
 * @param text The full text content to analyze
 * @param customPatterns Optional additional patterns to use for detection
 * @param minChapters Minimum number of chapters expected (default is 2)
 * @returns A ChunkingResult with detailed information
 */
export const detectChaptersDetailed = (
  text: string, 
  customPatterns?: RegExp[],
  minChapters: number = 2
): ChunkingResult => {
  return chunkByChapter(text, customPatterns, minChapters);
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
/**
 * Result of the chapter chunking operation with metadata
 */
export interface ChunkingResult {
  chapters: Chapter[];
  wasChunked: boolean;  // Indicates if actual chapters were detected
  originalText: string; // The original text content
  patternMatchCounts: Record<string, number>; // Statistics on pattern matches
}

/**
 * Chunks text content into chapters based on configured patterns
 * 
 * @param text The full text content to split into chapters
 * @param customPatterns Optional additional regex patterns to identify chapter headings
 * @param minChapters Minimum number of chapters expected (default is 2)
 * @returns A ChunkingResult object with chapters and metadata
 */
export const chunkByChapter = (
  text: string, 
  customPatterns?: RegExp[],
  minChapters: number = 2
): ChunkingResult => {
  console.log('Starting chapter chunking process...');
  
  // Create a combined set of patterns (standard + any custom ones)
  const patterns = [...CHAPTER_PATTERNS];
  if (customPatterns && customPatterns.length > 0) {
    patterns.push(...customPatterns);
    console.log(`Added ${customPatterns.length} custom chapter detection patterns`);
  }
  
  // Initialize pattern match counter to track which patterns are working
  const patternMatchCounts: Record<string, number> = {};
  
  // Split text into lines
  const lines = text.split('\n');
  console.log(`Text split into ${lines.length} lines for processing`);
  
  // Store detected chapter boundaries (line numbers)
  const chapterBoundaries: { lineNumber: number, title: string, patternName?: string }[] = [];
  
  // Scan through lines to find chapter headings
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (line.length === 0) continue;
    
    // Check if this line matches our chapter heading patterns
    let isHeading = false;
    let extractedTitle = '';
    let patternName = '';
    
    // First check against explicit patterns
    for (let j = 0; j < patterns.length; j++) {
      const pattern = patterns[j];
      const match = line.match(pattern);
      
      if (match) {
        isHeading = true;
        patternName = `pattern-${j}`; // Track which pattern matched
        
        // Count pattern matches for analytics
        patternMatchCounts[patternName] = (patternMatchCounts[patternName] || 0) + 1;
        
        // Extract an appropriate title based on the matched pattern
        if (match[1]?.toLowerCase() === 'chapter' || 
            match[1]?.toLowerCase() === 'part' || 
            match[1]?.toLowerCase() === 'section') {
          // For structured headings like "Chapter 1: Title"
          const chapterNum = match[2] || (chapterBoundaries.length + 1);
          const additionalTitle = match[3]?.trim();
          
          if (additionalTitle) {
            extractedTitle = `${match[1]} ${chapterNum}: ${additionalTitle}`;
          } else {
            extractedTitle = `${match[1]} ${chapterNum}`;
          }
        } else if (/^[IVXLCivxlc]+$/.test(match[1] || '')) {
          // For Roman numeral-only headings
          extractedTitle = `Chapter ${match[1]}`;
        } else if (/^\d+$/.test(match[1] || '')) {
          // For number-only headings
          extractedTitle = `Chapter ${match[1]}`;
        } else if (match[1] && match[2]) {
          // For patterns like "1. Title"
          extractedTitle = `Chapter ${match[1]}: ${match[2]}`;
        } else {
          // For other patterns, use the whole line or specific capture group
          extractedTitle = match[1] ? match[1] : line;
        }
        
        break;
      }
    }
    
    // If not matched by explicit patterns, try heuristic detection
    if (!isHeading) {
      // Short standalone line surrounded by blank lines might be a heading
      const isPreviousLineBlank = i === 0 || lines[i-1].trim().length === 0;
      const isNextLineBlank = i === lines.length-1 || lines[i+1].trim().length === 0;
      
      if (line.length > 2 && line.length < 50 && isPreviousLineBlank && isNextLineBlank) {
        // This looks like an isolated title line
        isHeading = true;
        patternName = 'heuristic-isolated';
        patternMatchCounts[patternName] = (patternMatchCounts[patternName] || 0) + 1;
        extractedTitle = line;
      }
      
      // ALL CAPS line that's relatively short might be a heading
      if (line.length > 2 && line.length < 60 && 
          line === line.toUpperCase() && 
          line !== line.toLowerCase()) {
        isHeading = true;
        patternName = 'heuristic-caps';
        patternMatchCounts[patternName] = (patternMatchCounts[patternName] || 0) + 1;
        extractedTitle = line;
      }
    }
    
    // If we detected a heading, add it to our boundaries
    if (isHeading) {
      console.log(`Detected chapter heading at line ${i+1}: "${extractedTitle}"`);
      chapterBoundaries.push({
        lineNumber: i,
        title: extractedTitle,
        patternName
      });
    }
  }
  
  // Process the detected chapters
  const chapters: Chapter[] = [];
  
  for (let i = 0; i < chapterBoundaries.length; i++) {
    const startLine = chapterBoundaries[i].lineNumber + 1; // Skip the heading line
    const endLine = i < chapterBoundaries.length - 1 
      ? chapterBoundaries[i + 1].lineNumber 
      : lines.length;
    
    // Extract the text for this chapter
    const chapterText = lines.slice(startLine, endLine).join('\n').trim();
    
    // Only add chapters with actual content
    if (chapterText.length > 0) {
      chapters.push({
        title: chapterBoundaries[i].title,
        text: chapterText
      });
    }
  }
  
  // Handle the case where no chapters were detected or not enough chapters
  // We consider the text successfully chunked if we found at least minChapters
  const wasChunked = chapters.length >= minChapters;
  
  if (chapters.length === 0 && text.trim().length > 0) {
    console.log('No chapter boundaries detected, treating entire text as one chapter');
    chapters.push({
      title: 'Chapter 1',
      text: text.trim()
    });
  }
  
  console.log(`Chunking complete. Extracted ${chapters.length} chapters.`);
  console.log(`Was text successfully chunked? ${wasChunked}`);
  console.log('Pattern match statistics:', patternMatchCounts);
  
  return {
    chapters,
    wasChunked,
    originalText: text,
    patternMatchCounts
  };
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
  
  // For a more accurate title extraction, we'll try to find consecutive
  // title-like lines at the beginning of the document
  let titleLines: string[] = [];
  let foundSignificantTitle = false;
  
  // Search through the first 25 lines for potential title candidates
  for (let i = 0; i < Math.min(25, lines.length); i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (line.length === 0) continue;
    
    // Look for short lines that might be titles
    if (line.length > 2 && line.length < 70) {
      // Check for lines that are in ALL CAPS (common for main titles)
      if (line === line.toUpperCase() && line !== line.toLowerCase()) {
        titleLines.push(line);
        foundSignificantTitle = true;
        continue;
      }
      
      // Look for lines that might be subtitles
      if (i < 10 && !isChapterHeading(line)) {
        // If we already found a significant title, this might be a subtitle
        if (foundSignificantTitle) {
          titleLines.push(line);
        } 
        // If we haven't found a title yet, this might be our main title
        else if (titleLines.length === 0) {
          titleLines.push(line);
        }
      }
    } else if (titleLines.length > 0) {
      // We've reached a line that doesn't look like a title after finding title-like lines
      // This likely means we're done with the title section
      break;
    }
  }
  
  // If we found multiple title lines, combine them
  if (titleLines.length > 0) {
    // Join title lines, but limit to a maximum of 2-3 lines to avoid overly long titles
    const combinedTitle = titleLines.slice(0, 3).join(' - ');
    return combinedTitle;
  }
  
  // If we couldn't find a good title candidate in the initial lines,
  // try to examine the first few characters more carefully
  if (text.length > 100) {
    const firstPart = text.substring(0, 100);
    const firstPartLines = firstPart.split('\n').filter(line => line.trim().length > 0);
    
    if (firstPartLines.length > 0) {
      // Try to find the first non-empty line that might be the title
      const potentialTitle = firstPartLines[0].trim();
      if (potentialTitle.length > 2 && potentialTitle.length < 50) {
        return potentialTitle;
      }
    }
  }
  
  // If we still couldn't find a title, try to get one from the first chapter
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
