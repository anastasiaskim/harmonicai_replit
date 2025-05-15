/**
 * Infrastructure Layer: Chapter Service
 * Handles chapter detection and processing functionality
 */

export interface ChapterDTO {
  title: string;
  text: string;
}

class ChapterService {
  /**
   * Detect chapters in text content
   */
  detectChapters(text: string): ChapterDTO[] {
    if (!text || typeof text !== 'string') {
      return [];
    }

    // Common chapter markers
    const chapterMarkers = [
      /chapter\s+(\d+|[ivxlcdm]+)/i,
      /part\s+(\d+|[ivxlcdm]+)/i,
      /section\s+(\d+|[ivxlcdm]+)/i,
      /book\s+(\d+|[ivxlcdm]+)/i
    ];

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
      
      for (const marker of chapterMarkers) {
        if (marker.test(line)) {
          isChapterHeading = true;
          
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

    return chapters;
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