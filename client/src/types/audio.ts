/**
 * Represents a chapter in the generated audiobook
 */
export interface GeneratedChapter {
  id: number;
  title: string;
  audioUrl: string;
  duration: number; // in seconds
  size: number; // in bytes
}

/**
 * Represents a chapter in the text processing pipeline
 */
export interface TextChapter {
  title: string;
  text: string;
}

/**
 * Represents a chapter in the audio processing pipeline
 */
export interface AudioChapter extends TextChapter {
  id: number;
  audioUrl: string;
  duration: number;
  size: number;
  status?: 'idle' | 'processing' | 'ready' | 'failed';
  progress?: number;
  error?: string;
} 