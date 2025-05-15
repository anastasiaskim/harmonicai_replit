import React from 'react';
import { AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface AIChapterConfidenceProps {
  wasChunked: boolean;
  patternMatchCounts?: Record<string, number>;
  chaptersCount: number;
}

/**
 * Displays AI confidence in chapter detection with visual indicators
 */
const AIChapterConfidence: React.FC<AIChapterConfidenceProps> = ({
  wasChunked,
  patternMatchCounts = {},
  chaptersCount
}) => {
  // Calculate approximate confidence level based on matched patterns
  const calculateConfidence = (): number => {
    if (!wasChunked) return 0;
    
    // Count total pattern matches
    const totalMatches = Object.values(patternMatchCounts).reduce((sum, count) => sum + count, 0);
    
    // If we have chapters but no pattern matches (edge case), give 60% confidence
    if (chaptersCount > 1 && totalMatches === 0) return 60;
    
    // Calculate confidence: higher if we have more pattern matches of the same type
    // indicating consistent chapter formatting
    const uniquePatterns = Object.keys(patternMatchCounts).length;
    const mostCommonPatternCount = Math.max(...Object.values(patternMatchCounts));
    
    // Highest confidence if we have many chapters with the same pattern
    if (mostCommonPatternCount >= 3 && uniquePatterns === 1) return 95;
    
    // High confidence if we have consistent patterns
    if (mostCommonPatternCount >= 3) return 85;
    
    // Medium confidence if we have some pattern consistency
    if (mostCommonPatternCount >= 2) return 75;
    
    // Lower confidence if we have very few matches or inconsistent patterns
    return 60;
  };
  
  const confidence = calculateConfidence();
  
  // Determine status based on confidence
  const getStatusInfo = () => {
    if (!wasChunked) {
      return {
        icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
        text: "No clear chapters detected",
        textColor: "text-amber-700",
        bg: "bg-amber-50",
        border: "border-amber-200"
      };
    }
    
    if (confidence >= 80) {
      return {
        icon: <CheckCircle className="h-4 w-4 text-emerald-500" />,
        text: "High confidence detection",
        textColor: "text-emerald-700",
        bg: "bg-emerald-50",
        border: "border-emerald-200"
      };
    }
    
    if (confidence >= 60) {
      return {
        icon: <CheckCircle className="h-4 w-4 text-blue-500" />,
        text: "Medium confidence detection",
        textColor: "text-blue-700",
        bg: "bg-blue-50",
        border: "border-blue-200"
      };
    }
    
    return {
      icon: <HelpCircle className="h-4 w-4 text-amber-500" />,
      text: "Low confidence detection",
      textColor: "text-amber-700",
      bg: "bg-amber-50",
      border: "border-amber-200"
    };
  };
  
  const status = getStatusInfo();
  
  return (
    <div className={`p-3 rounded-md ${status.bg} ${status.border} border mb-4`}>
      <div className="flex items-center mb-2">
        {status.icon}
        <span className={`ml-2 text-sm font-medium ${status.textColor}`}>
          {status.text}
        </span>
        <span className="ml-auto text-xs text-gray-500">
          {wasChunked 
            ? `${chaptersCount} chapters found` 
            : 'Manual chapter split recommended'
          }
        </span>
      </div>
      
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">AI Confidence</span>
          <span className="font-medium">{confidence}%</span>
        </div>
        <Progress value={confidence} className="h-1.5" />
      </div>
      
      {Object.keys(patternMatchCounts).length > 0 && (
        <div className="mt-3 text-xs text-gray-600">
          <span className="block mb-1 text-gray-500">Pattern matches:</span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(patternMatchCounts).map(([pattern, count]) => (
              <span 
                key={pattern} 
                className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700"
              >
                {pattern.replace('pattern-', 'Type ')} ({count})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIChapterConfidence;