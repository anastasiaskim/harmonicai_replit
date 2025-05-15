import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AIChapterConfidenceProps {
  confidenceLevels: Record<string, number>;
  usedAI: boolean;
}

export function AIChapterConfidence({ confidenceLevels, usedAI }: AIChapterConfidenceProps) {
  // If AI wasn't used or no confidence levels are available, don't show anything
  if (!usedAI || !confidenceLevels || Object.keys(confidenceLevels).length === 0) {
    return null;
  }
  
  // Convert confidence levels to array for rendering
  const confidenceData = Object.entries(confidenceLevels).map(([title, confidence]) => ({
    title,
    confidence,
    quality: getConfidenceQuality(confidence)
  }));
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">AI Chapter Detection</CardTitle>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-100">
            AI Powered
          </Badge>
        </div>
        <CardDescription>
          AI confidence levels for detected chapter headings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {confidenceData.map((chapter, index) => (
            <div key={index} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium truncate max-w-[70%]" title={chapter.title}>
                  {chapter.title}
                </span>
                <span className={getConfidenceTextColor(chapter.quality)}>
                  {(chapter.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <Progress 
                value={chapter.confidence * 100} 
                className={getConfidenceProgressColor(chapter.quality)}
              />
            </div>
          ))}
        </div>
        
        <div className="mt-6 pt-4 border-t border-gray-100 text-sm text-gray-500">
          <p>Higher confidence indicates better chapter detection accuracy.</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper functions for confidence level styling
function getConfidenceQuality(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

function getConfidenceTextColor(quality: 'high' | 'medium' | 'low'): string {
  switch (quality) {
    case 'high': return 'text-green-600 font-medium';
    case 'medium': return 'text-amber-600 font-medium';
    case 'low': return 'text-red-600 font-medium';
    default: return 'text-gray-600';
  }
}

function getConfidenceProgressColor(quality: 'high' | 'medium' | 'low'): string {
  switch (quality) {
    case 'high': return 'bg-green-100 [&>div]:bg-green-600';
    case 'medium': return 'bg-amber-100 [&>div]:bg-amber-500';
    case 'low': return 'bg-red-100 [&>div]:bg-red-500';
    default: return '';
  }
}