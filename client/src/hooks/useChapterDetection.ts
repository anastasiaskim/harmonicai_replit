import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { type ChunkingResult } from '@/lib/chapterDetection';

/**
 * Hook for chapter detection functionality
 * 
 * Provides methods to detect chapters in text content using either
 * AI-powered detection or fallback pattern-based detection.
 */
export function useChapterDetection() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  /**
   * Detect chapters in text content
   * 
   * @param text Text content to analyze for chapters
   * @param useAI Whether to use AI-powered detection (if available)
   * @returns Detection result or null on error
   */
  const detectChapters = async (
    text: string,
    useAI: boolean = true
  ): Promise<ChunkingResult | null> => {
    if (!text || text.trim().length === 0) {
      setError('No text content provided');
      toast({
        title: 'Error',
        description: 'No text content provided for chapter detection.',
        variant: 'destructive',
      });
      return null;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Call API to detect chapters
      const response = await apiRequest('/api/detect-chapters', {
        method: 'POST',
        body: JSON.stringify({ text, useAI }),
      });
      
      // Parse response as ChunkingResult
      const result = response as ChunkingResult;
      
      // Show appropriate feedback based on detection result
      if (result.wasChunked) {
        toast({
          title: 'Chapters Detected',
          description: `${result.chapters.length} chapters detected ${
            result.aiDetection ? 'using AI analysis' : 'using pattern matching'
          }.`,
        });
      } else {
        toast({
          title: 'No Chapters Detected',
          description: 'Text will be treated as a single chapter.',
        });
      }
      
      return result;
    } catch (err) {
      console.error('Error detecting chapters:', err);
      
      const errorMessage = err instanceof Error
        ? err.message
        : 'Failed to detect chapters. Please try again.';
      
      setError(errorMessage);
      toast({
        title: 'Chapter Detection Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
  return {
    detectChapters,
    isLoading,
    error,
  };
}