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

export const detectChapters = (text: string): Chapter[] => {
  // Split text into lines
  const lines = text.split('\n');
  const chapters: Chapter[] = [];
  
  let currentChapter = '';
  let currentTitle = 'Chapter 1';
  let chapterIndex = 1;
  
  // Process each line
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
