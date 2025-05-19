import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface GenerateSectionProps {
  onGenerate: () => void;
  isGenerating: boolean;
  isDisabled: boolean;
}

const GenerateSection: React.FC<GenerateSectionProps> = ({
  onGenerate,
  isGenerating,
  isDisabled
}) => {
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
          
          {isGenerating && (
            <div className="pt-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Processing chapters...</span>
                <span className="text-xs text-primary">Please wait</span>
              </div>
              <Progress className="h-1" value={undefined} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default GenerateSection;
