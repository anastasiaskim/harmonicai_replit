/**
 * Infrastructure Layer: AI Service
 * Handles Google AI API integration for enhanced chapter detection
 */

import axios from 'axios';

const GOOGLE_AI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

export interface ChapterDetectionResult {
  chapters: {
    title: string;
    startIndex: number;
    endIndex: number;
    confidence: number;
  }[];
  originalText: string;
  success: boolean;
  error?: string;
}

export class AIService {
  /**
   * Detect chapters in text content using Google AI Gemini 2.0 Flash API
   * 
   * @param text The text content to analyze
   * @param apiKey The Google AI Studio API key
   * @returns A ChapterDetectionResult with detected chapters and confidence levels
   */
  async detectChapters(text: string, apiKey: string): Promise<ChapterDetectionResult> {
    try {
      if (!text || !apiKey) {
        return {
          chapters: [],
          originalText: text || '',
          success: false,
          error: 'Missing text content or API key'
        };
      }

      // Build the prompt for Gemini API
      const prompt = this.buildChapterDetectionPrompt(text);

      const response = await axios.post(
        `${GOOGLE_AI_API_URL}?key=${apiKey}`,
        {
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      // Process the API response
      const aiResponse = response.data;
      
      // Log the raw response for debugging
      console.log('Google AI API Response:', JSON.stringify(aiResponse));
      
      // Extract chapters from the AI response
      const chapters = this.parseAIResponse(aiResponse, text);
      
      return {
        chapters,
        originalText: text,
        success: true
      };
    } catch (error) {
      console.error('Error in AI chapter detection:', error);
      
      return {
        chapters: [],
        originalText: text,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Build a prompt for the AI to detect chapter headings
   */
  private buildChapterDetectionPrompt(text: string): string {
    // Sample a short portion of the text to include in the prompt
    const textSample = text.substring(0, 2000) + (text.length > 2000 ? '...' : '');
    
    return `You are an expert text analyzer tasked with identifying chapter headings in books.

TASK:
Identify all chapter headings in the provided book text.

INSTRUCTIONS:
1. Analyze the text for patterns that indicate chapter headings.
2. Common chapter heading formats include:
   - "Chapter X" (where X is a number or roman numeral)
   - "Chapter X: Title"
   - "X. Title" (where X is a number)
   - Standalone titles that appear to be chapter headers
   - ALL CAPS lines that serve as chapter separators
   - Titles preceded by symbols like * or -

3. For each identified chapter heading:
   - Provide the exact text of the heading
   - Provide the character position (index) where it starts and ends in the original text
   - Assign a confidence level from 0.0 to 1.0 (where 1.0 is highest confidence)

RESPONSE FORMAT:
Respond with a JSON array of chapter objects with these properties:
- title: The full text of the chapter heading
- startIndex: The starting character position in the original text
- endIndex: The ending character position in the original text
- confidence: A number from 0.0 to 1.0 indicating confidence

Example response:
[
  {
    "title": "Chapter 1: The Beginning",
    "startIndex": 120,
    "endIndex": 142,
    "confidence": 0.95
  },
  {
    "title": "Chapter 2: The Middle",
    "startIndex": 2500,
    "endIndex": 2520,
    "confidence": 0.92
  }
]

Here is the beginning of the text to analyze:
${textSample}

Now analyze the FULL text and identify ALL chapter headings with their positions and confidence levels.
IMPORTANT: Return ONLY the JSON array, nothing else.`;
  }

  /**
   * Parse the AI response to extract chapter information
   */
  private parseAIResponse(aiResponse: any, originalText: string): {
    title: string;
    startIndex: number;
    endIndex: number;
    confidence: number;
  }[] {
    try {
      // Extract the text content from the AI response
      const textContent = aiResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!textContent) {
        console.error('Invalid AI response format');
        return [];
      }

      // Try to parse the JSON response
      let jsonResponse;
      try {
        // Find the first [ and last ] to extract only the JSON array
        const startIdx = textContent.indexOf('[');
        const endIdx = textContent.lastIndexOf(']') + 1;
        
        if (startIdx >= 0 && endIdx > startIdx) {
          const jsonString = textContent.substring(startIdx, endIdx);
          jsonResponse = JSON.parse(jsonString);
        } else {
          console.error('Could not find JSON array in AI response');
          return [];
        }
      } catch (e) {
        console.error('Failed to parse AI response as JSON:', e);
        return [];
      }

      // Validate and transform the parsed JSON
      if (Array.isArray(jsonResponse)) {
        return jsonResponse.map(chapter => {
          // Ensure all required properties exist and are of the correct type
          return {
            title: typeof chapter.title === 'string' ? chapter.title : 'Untitled Chapter',
            startIndex: typeof chapter.startIndex === 'number' ? chapter.startIndex : 0,
            endIndex: typeof chapter.endIndex === 'number' ? chapter.endIndex : 0,
            confidence: typeof chapter.confidence === 'number' ? 
              Math.min(Math.max(chapter.confidence, 0), 1) : 0.5 // Clamp between 0 and 1
          };
        }).filter(chapter => 
          // Filter out invalid chapters (e.g., negative indices or empty titles)
          chapter.title.trim() !== '' && 
          chapter.startIndex >= 0 && 
          chapter.endIndex > chapter.startIndex &&
          chapter.endIndex <= originalText.length
        );
      }
      
      return [];
    } catch (error) {
      console.error('Error parsing AI response:', error);
      return [];
    }
  }
}

export const aiService = new AIService();