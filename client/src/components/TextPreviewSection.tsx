import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChaptersSection } from '@/components/ChaptersSection';
import { ManualChapterSplitSection } from '@/components/ManualChapterSplitSection';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface Chapter {
  title: string;
  text: string;
}

interface TextPreviewSectionProps {
  text: string;
  onChaptersSelected: (chapters: Chapter[]) => void;
}

export function TextPreviewSection({ text, onChaptersSelected }: TextPreviewSectionProps) {
  const [chaptersState, setChaptersState] = useState<{
    chapters: Chapter[];
    wasChunked: boolean;
    aiDetection?: boolean;
    confidenceLevels?: Record<string, number>;
  } | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [showManualSplit, setShowManualSplit] = useState(false);

  // Mutation for AI-powered chapter detection
  const detectChaptersMutation = useMutation({
    mutationFn: () => {
      return apiRequest(
        'POST',
        '/api/detect-chapters',
        {
          text,
          userId: 'default'
        }
      ).then(res => res.json());
    },
    onSuccess: (data) => {
      setChaptersState({
        chapters: data.chapters,
        wasChunked: data.wasChunked,
        aiDetection: data.aiDetection,
        confidenceLevels: data.confidenceLevels
      });
      setError(null);
      setShowManualSplit(false);
    },
    onError: (error: any) => {
      console.error('Error detecting chapters:', error);
      setError('Failed to detect chapters. Please try manually splitting the text.');
      setShowManualSplit(true);
    }
  });

  // Start chapter detection on component mount
  useEffect(() => {
    if (text) {
      detectChaptersMutation.mutate();
    }
  }, [text]);

  // Handle manual chapter creation
  const handleManualChapters = (chapters: Chapter[]) => {
    setChaptersState({
      chapters,
      wasChunked: chapters.length > 1,
      aiDetection: false
    });
    setShowManualSplit(false);
  };

  // Handle retry of automatic detection
  const handleRetryDetection = () => {
    setError(null);
    detectChaptersMutation.mutate();
  };

  // Handle switch to manual mode
  const handleSwitchToManual = () => {
    setShowManualSplit(true);
  };

  // Determine if we're loading, showing results, or showing manual input
  const isLoading = detectChaptersMutation.isPending;
  const hasChapters = chaptersState !== null && chaptersState.chapters.length > 0;

  return (
    <div className="space-y-8">
      {/* Loading State */}
      {isLoading && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-4 w-[150px]" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex justify-between pt-4">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
        </Card>
      )}

      {/* Error State */}
      {error && !showManualSplit && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <div className="flex space-x-4 mt-4">
            <Button onClick={handleRetryDetection} variant="outline" size="sm">
              Retry Automatic Detection
            </Button>
            <Button onClick={handleSwitchToManual} size="sm">
              Split Manually
            </Button>
          </div>
        </Alert>
      )}

      {/* Manual Split Section */}
      {showManualSplit && (
        <ManualChapterSplitSection
          text={text}
          onChaptersCreated={handleManualChapters}
        />
      )}

      {/* Success State with Chapter Selection */}
      {!isLoading && !showManualSplit && hasChapters && (
        <div className="space-y-6">
          {chaptersState && !chaptersState.wasChunked && (
            <Alert className="mb-4 bg-yellow-50 border-yellow-200">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800">Chapter Detection Notice</AlertTitle>
              <AlertDescription className="text-yellow-700">
                We couldn't automatically detect multiple chapters in your text. If you want to split it into chapters manually, 
                click the button below.
              </AlertDescription>
              <div className="mt-4">
                <Button onClick={handleSwitchToManual} variant="outline" size="sm">
                  Split Manually
                </Button>
              </div>
            </Alert>
          )}

          {chaptersState && chaptersState.wasChunked && (
            <Alert className="mb-4 bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Chapters Detected</AlertTitle>
              <AlertDescription className="text-green-700">
                We successfully detected {chaptersState.chapters.length} chapters in your text
                {chaptersState.aiDetection ? " using AI technology" : ""}.
              </AlertDescription>
            </Alert>
          )}

          {chaptersState && (
            <ChaptersSection
              chapters={chaptersState.chapters}
              wasChunked={chaptersState.wasChunked}
              aiDetection={chaptersState.aiDetection}
              confidenceLevels={chaptersState.confidenceLevels}
              onSelectChapters={onChaptersSelected}
            />
          )}
        </div>
      )}
    </div>
  );
}