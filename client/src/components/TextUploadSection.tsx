import { useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useChapterDetection } from '@/hooks/useChapterDetection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, FileText } from 'lucide-react';
import { getTextPreview, extractBookTitle } from '@/lib/chapterDetection';

interface TextUploadSectionProps {
  onTextLoaded: (text: string, fileName: string) => void;
  onChaptersDetected: (result: any) => void;
}

export function TextUploadSection({ 
  onTextLoaded, 
  onChaptersDetected 
}: TextUploadSectionProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [textContent, setTextContent] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { detectChapters, isLoading: isDetecting } = useChapterDetection();
  
  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    
    if (selectedFile) {
      if (selectedFile.type !== 'text/plain' && !selectedFile.name.endsWith('.txt')) {
        toast({
          title: 'Invalid File',
          description: 'Please upload a .txt file',
          variant: 'destructive'
        });
        return;
      }
      
      if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: 'File Too Large',
          description: 'Please upload a file smaller than 10MB',
          variant: 'destructive'
        });
        return;
      }
      
      setFile(selectedFile);
    }
  };
  
  // Handle click on upload button
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };
  
  // Process uploaded file
  const processFile = async () => {
    if (!file) return;
    
    setIsLoading(true);
    try {
      // Read file contents
      const text = await readFileAsText(file);
      
      // Check if the text is too long
      if (text.length > 100000) { // 100K characters limit 
        toast({
          title: 'Text Too Long',
          description: 'The text content is too large. Please use a smaller file (max 100,000 characters).',
          variant: 'destructive'
        });
        return;
      }
      
      setTextContent(text);
      
      // Notify parent about the uploaded text
      onTextLoaded(text, file.name);
      
      // Attempt to detect chapters
      toast({
        title: 'Detecting Chapters',
        description: 'Analyzing text to detect chapters...',
      });
      
      const result = await detectChapters(text, true);
      
      if (result) {
        onChaptersDetected(result);
        
        toast({
          title: 'File Processed',
          description: `${result.chapters.length} ${result.chapters.length === 1 ? 'chapter' : 'chapters'} detected. Text content loaded successfully.`,
        });
      }
    } catch (error) {
      console.error('Error processing file:', error);
      
      // More descriptive error message
      let errorMessage = 'Failed to process the file. Please try again.';
      
      if (error instanceof Error) {
        // Provide more specific error messages based on the error type
        if (error.message.includes('chapter')) {
          errorMessage = 'Could not detect chapters in the text. Please try a different file.';
        } else if (error.message.includes('read')) {
          errorMessage = 'Could not read the file. The file might be corrupted or in an unsupported format.';
        }
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
      
      // Still allow the text to be used - create a basic single chapter
      const basicResult = {
        chapters: [{ title: "Chapter 1", text: textContent }],
        wasChunked: false,
        aiDetection: false
      };
      onChaptersDetected(basicResult);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle direct text input
  const handleAnalyzeText = async () => {
    if (!textContent.trim()) {
      toast({
        title: 'Empty Text',
        description: 'Please enter some text to analyze',
        variant: 'destructive'
      });
      return;
    }
    
    setIsLoading(true);
    try {
      // Generate a filename based on content
      const fileName = extractBookTitle(textContent) + '.txt';
      
      // Notify parent about the entered text
      onTextLoaded(textContent, fileName);
      
      // Attempt to detect chapters
      const result = await detectChapters(textContent, true);
      
      if (result) {
        onChaptersDetected(result);
      }
      
      toast({
        title: 'Text Analyzed',
        description: 'Text content processed successfully',
      });
    } catch (error) {
      console.error('Error processing text:', error);
      toast({
        title: 'Error',
        description: 'Failed to process the text. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Read file as text
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  };
  
  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Upload Text File</h2>
        <p className="text-gray-500">
          Upload a .txt file or paste your text to convert to audio
        </p>
      </div>
      
      <div className="grid gap-8 md:grid-cols-2">
        {/* File Upload */}
        <div className="space-y-4">
          <div 
            className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer"
            onClick={handleUploadClick}
          >
            <Upload className="h-8 w-8 mx-auto mb-4 text-gray-400" />
            <h3 className="text-base font-medium">Upload .txt File</h3>
            <p className="text-sm text-gray-500 mt-1">
              Drag and drop or click to select a file
            </p>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          
          {file && (
            <div className="bg-gray-50 p-3 rounded-md flex items-center justify-between">
              <div className="flex items-center">
                <FileText className="h-5 w-5 text-blue-500 mr-2" />
                <div>
                  <p className="text-sm font-medium truncate max-w-[200px]">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <Button 
                onClick={processFile} 
                disabled={isLoading || isDetecting}
                size="sm"
              >
                {isLoading || isDetecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Process'
                )}
              </Button>
            </div>
          )}
        </div>
        
        {/* Direct Text Input */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="text-input">Or Enter Text Directly</Label>
            <textarea
              id="text-input"
              className="w-full h-40 rounded-md border border-gray-300 p-2 text-sm"
              placeholder="Enter your text here..."
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
            />
          </div>
          <Button 
            onClick={handleAnalyzeText} 
            disabled={isLoading || isDetecting || !textContent.trim()}
            className="w-full"
          >
            {isLoading || isDetecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {isDetecting ? 'Detecting Chapters...' : 'Processing...'}
              </>
            ) : (
              'Analyze Text'
            )}
          </Button>
          
          {textContent && (
            <div className="bg-gray-50 p-3 rounded-md">
              <p className="text-xs text-gray-500">
                Preview:
              </p>
              <p className="text-sm mt-1">
                {getTextPreview(textContent, 100)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}