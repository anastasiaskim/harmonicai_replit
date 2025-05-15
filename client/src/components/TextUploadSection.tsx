import React, { useState } from 'react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { FileText, AlignLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import AIChapterConfidence from './AIChapterConfidence';

interface ProcessedResult {
  text: string;
  chapters: { title: string; text: string }[];
  charCount: number;
  wasChunked: boolean;
  patternMatchCounts?: Record<string, number>;
}

interface TextUploadSectionProps {
  onTextProcessed: (
    result: ProcessedResult | null,
    error?: string
  ) => void;
}

const TextUploadSection: React.FC<TextUploadSectionProps> = ({ onTextProcessed }) => {
  const [text, setText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessedResult | null>(null);
  const { toast } = useToast();

  const processText = async () => {
    if (!text.trim()) {
      setError('Please enter some text to process');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Call the API to process the direct text input
      const response = await fetch('/api/process-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process text');
      }
      
      const data = await response.json();
      
      // Ensure data has the wasChunked property or set default based on chapter count
      if (typeof data.wasChunked !== 'boolean') {
        data.wasChunked = data.chapters && data.chapters.length > 1;
      }
      
      setResult(data);
      onTextProcessed(data);
      
      // Check if chapters were detected successfully
      if (data.wasChunked) {
        toast({
          title: "Text Successfully Processed",
          description: `Your text has been analyzed and divided into ${data.chapters?.length || 0} chapters.`,
        });
      } else {
        toast({
          title: "Text Processed",
          description: "Your text has been processed, but no chapters could be detected automatically.",
          variant: "default"
        });
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to process text';
      setError(errorMessage);
      onTextProcessed(null, errorMessage);
      
      toast({
        title: "Processing Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <CardTitle className="font-bold text-xl text-gray-800 mb-4 flex items-center">
          <AlignLeft className="h-5 w-5 text-primary mr-2" />
          Paste Text Content
        </CardTitle>
        
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {result && !error && (
          <AIChapterConfidence 
            wasChunked={result.wasChunked}
            patternMatchCounts={result.patternMatchCounts}
            chaptersCount={result.chapters?.length || 0}
          />
        )}
        
        <div className="mb-4">
          <Textarea
            placeholder="Paste your text content here..."
            className="font-mono text-sm resize-y h-44"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          
          <div className="flex justify-between items-center mt-2">
            <div className="text-xs text-gray-500">
              {text.length > 0 ? (
                <Badge variant="outline" className="text-xs">
                  {text.length.toLocaleString()} characters
                </Badge>
              ) : (
                <span>Enter text to analyze</span>
              )}
            </div>
            
            <Button 
              onClick={processText}
              disabled={isProcessing || !text.trim()}
              className="bg-primary"
            >
              {isProcessing ? (
                <>
                  <FileText className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Analyze Text
                </>
              )}
            </Button>
          </div>
        </div>
        
        {result && result.chapters && result.chapters.length > 0 && (
          <div className="mt-4 p-3 bg-gray-50 rounded-md border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Preview of Detected Chapters:</h3>
            <ul className="space-y-1">
              {result.chapters.slice(0, 3).map((chapter, index) => (
                <li key={index} className="text-xs text-gray-600 truncate">
                  <span className="font-medium">{chapter.title}:</span> {chapter.text.substring(0, 60)}...
                </li>
              ))}
              {result.chapters.length > 3 && (
                <li className="text-xs text-gray-500">
                  + {result.chapters.length - 3} more chapters
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TextUploadSection;