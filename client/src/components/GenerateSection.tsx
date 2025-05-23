import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

type GenerationProgress = {
  current: number;
  total: number;
  status: 'idle' | 'generating' | 'complete' | 'error';
};

interface GenerateSectionProps {
  onGenerate: () => void;
  isGenerating: boolean;
  isDisabled: boolean;
  progress: GenerationProgress;
}

const GenerateSection: React.FC<GenerateSectionProps> = ({
  onGenerate,
  isGenerating,
  isDisabled,
  progress
}) => {
  // Provide a default value for progress if undefined
  const safeProgress = progress || { current: 0, total: 0, status: 'idle' };
  // Calculate progress percentage, clamped between 0 and 100
  const progressPercentage = safeProgress.total > 0 
    ? Math.min(100, Math.round((safeProgress.current / safeProgress.total) * 100))
    : 0;

  // Get status message based on progress status
  const getStatusMessage = () => {
    switch (safeProgress.status) {
      case 'generating':
        return `Processing chapter ${safeProgress.current} of ${safeProgress.total}`;
      case 'complete':
        return 'Generation complete!';
      case 'error':
        return 'Generation failed';
      default:
        return 'Ready to generate';
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-800">Ready to create your audiobook?</h3>
              <p className="text-sm text-gray-500">Your text will be split into chapters and processed</p>
            </div>
            <Button 
              onClick={onGenerate}
              disabled={isDisabled || isGenerating}
              className="bg-primary hover:bg-primary/90"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Audiobook
            </Button>
          </div>
          
          {isDisabled && (
            <Alert variant="destructive" className="mt-4 bg-red-100 border-red-200 text-red-800">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No content to process. Please upload a file or paste text first.
              </AlertDescription>
            </Alert>
          )}
          
          {(isGenerating || safeProgress.status !== 'idle') && (
            <div className="pt-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">{getStatusMessage()}</span>
                <span className="text-xs text-primary">
                  {safeProgress.status === 'complete' && <CheckCircle2 className="h-4 w-4 inline mr-1" />}
                  {safeProgress.status === 'error' && <XCircle className="h-4 w-4 inline mr-1" />}
                  {progressPercentage}%
                </span>
              </div>
              <Progress 
                className="h-1" 
                value={progressPercentage} 
                max={100}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default GenerateSection;
