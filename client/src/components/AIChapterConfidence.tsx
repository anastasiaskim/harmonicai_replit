import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';

interface AIChapterConfidenceProps {
  title: string;
  confidence?: number;
  showDetails?: boolean;
}

/**
 * Component to display AI confidence in chapter detection
 * 
 * Shows a confidence indicator with color coding and optional detailed information
 */
export function AIChapterConfidence({
  title,
  confidence,
  showDetails = false,
}: AIChapterConfidenceProps) {
  // If no confidence provided, return null
  if (confidence === undefined) {
    return null;
  }
  
  // Convert confidence from 0-1 to percentage
  const confidencePercent = Math.round(confidence * 100);
  
  // Color coding based on confidence level
  const getConfidenceColor = () => {
    if (confidencePercent >= 85) return 'bg-green-500';
    if (confidencePercent >= 70) return 'bg-green-400';
    if (confidencePercent >= 55) return 'bg-yellow-400';
    return 'bg-orange-500';
  };
  
  // Text representation of confidence level
  const getConfidenceText = () => {
    if (confidencePercent >= 85) return 'High';
    if (confidencePercent >= 70) return 'Good';
    if (confidencePercent >= 55) return 'Medium';
    return 'Low';
  };
  
  // Badge color based on confidence level
  const getBadgeVariant = (): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (confidencePercent >= 85) return 'default';
    if (confidencePercent >= 70) return 'default';
    if (confidencePercent >= 55) return 'secondary';
    return 'destructive';
  };
  
  return (
    <div className="flex items-center space-x-2">
      {showDetails ? (
        <div className="flex flex-col space-y-1 w-full max-w-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">AI Confidence</span>
            <Badge variant={getBadgeVariant()} className="ml-2">
              {getConfidenceText()} ({confidencePercent}%)
            </Badge>
          </div>
          <Progress value={confidencePercent} className={getConfidenceColor()} />
        </div>
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center cursor-help">
                <Info className="h-4 w-4 text-muted-foreground mr-1" />
                <span className="text-xs text-muted-foreground">
                  {getConfidenceText()} confidence
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              <div className="space-y-2 p-1">
                <p className="font-medium">AI Detection Confidence</p>
                <p className="text-sm">
                  {confidencePercent}% confidence that "{title}" is a valid chapter.
                </p>
                <Progress value={confidencePercent} className={getConfidenceColor()} />
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}