import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AIChapterConfidenceProps {
  confidenceLevels: Record<string, number>;
  usedAI: boolean;
}

export function AIChapterConfidence({ confidenceLevels, usedAI }: AIChapterConfidenceProps) {
  // If AI was not used or there are no confidence levels, return null
  if (!usedAI || !confidenceLevels || Object.keys(confidenceLevels).length === 0) {
    return null;
  }
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Sparkles className="h-5 w-5 text-purple-500" />
          AI Detection Confidence
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-sm">
                <p>
                  These confidence scores show how certain our AI is about each detected chapter. 
                  Higher confidence means more reliable detection. You may want to review low-confidence chapters.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Object.entries(confidenceLevels).map(([chapter, confidence]) => (
            <div key={chapter} className="space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium truncate" title={chapter}>
                  {chapter.length > 30 ? `${chapter.substring(0, 30)}...` : chapter}
                </span>
                <span className={`font-mono ${getConfidenceTextColor(getConfidenceQuality(confidence))}`}>
                  {Math.round(confidence * 100)}%
                </span>
              </div>
              <Progress 
                value={confidence * 100} 
                className={getConfidenceProgressColor(getConfidenceQuality(confidence))}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper functions
function getConfidenceQuality(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

function getConfidenceTextColor(quality: 'high' | 'medium' | 'low'): string {
  switch (quality) {
    case 'high': return 'text-green-600';
    case 'medium': return 'text-amber-600';
    case 'low': return 'text-red-600';
    default: return '';
  }
}

function getConfidenceProgressColor(quality: 'high' | 'medium' | 'low'): string {
  switch (quality) {
    case 'high': return 'bg-green-100 [&>div]:bg-green-600';
    case 'medium': return 'bg-amber-100 [&>div]:bg-amber-600';
    case 'low': return 'bg-red-100 [&>div]:bg-red-600';
    default: return '';
  }
}