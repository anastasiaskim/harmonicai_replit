import React, { useState } from 'react';
import { Card, CardContent, CardTitle, CardHeader, CardFooter } from '@/components/ui/card';
import { Eye, BookOpen, AlertCircle, FileText, Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatFileSize } from '@/lib/fileHelpers';

interface FileMetadata {
  key: string;
  name: string;
  size: number;
  url: string;
  mimeType: string;
}

interface TextPreviewSectionProps {
  text: string;
  chapters: { title: string; text: string }[];
  fileMetadata?: FileMetadata | null;
  error?: string | null;
  wasChunked?: boolean;
}

const TextPreviewSection: React.FC<TextPreviewSectionProps> = ({ 
  text, 
  chapters, 
  fileMetadata, 
  error,
  wasChunked
}) => {
  // State for chapter navigation
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  
  // Handle copy text to clipboard
  const copyToClipboard = () => {
    if (text) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  // Navigate between chapters
  const nextChapter = () => {
    if (currentChapterIndex < chapters.length - 1) {
      setCurrentChapterIndex(currentChapterIndex + 1);
    }
  };
  
  const prevChapter = () => {
    if (currentChapterIndex > 0) {
      setCurrentChapterIndex(currentChapterIndex - 1);
    }
  };
  
  // Get current chapter (if any)
  const currentChapter = chapters.length > 0 ? chapters[currentChapterIndex] : null;
  
  // Format character count
  const formatCharCount = (count: number) => {
    if (count < 1000) return `${count} characters`;
    return `${(count / 1000).toFixed(1)}k characters`;
  };
  
  return (
    <Card className="mb-6">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="font-bold text-xl text-gray-800 flex items-center">
            <Eye className="h-5 w-5 text-primary mr-2" />
            Extracted Text
          </CardTitle>
          
          {text && !error && (
            <div className="flex space-x-3 items-center">
              <Badge variant="outline" className="text-xs">
                {formatCharCount(text.length)}
              </Badge>
              {chapters.length > 0 && (
                <Badge 
                  variant={wasChunked === false ? "secondary" : "outline"} 
                  className={`text-xs ${wasChunked === false ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : ""}`}
                >
                  <BookOpen className="h-3 w-3 mr-1" />
                  {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'}
                  {wasChunked === false && " (auto-detection failed)"}
                </Badge>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2"
                onClick={copyToClipboard}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="ml-1 text-xs">{copied ? 'Copied' : 'Copy'}</span>
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        {/* File metadata if available */}
        {fileMetadata && (
          <div className="bg-gray-50 rounded-lg p-3 mb-4 border border-gray-200">
            <div className="flex items-center">
              <FileText className="h-5 w-5 text-primary mr-2" />
              <div>
                <h4 className="text-sm font-medium">{fileMetadata.name}</h4>
                <p className="text-xs text-gray-500">{formatFileSize(fileMetadata.size)}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Text Preview Area */}
        <ScrollArea className="border border-gray-200 rounded-lg p-4 h-64 font-serif text-gray-800 bg-gray-50">
          {text ? (
            <div className="whitespace-pre-line">
              {text}
            </div>
          ) : (
            <p className="text-gray-400 text-center my-12">
              Upload a text file to extract and preview content
            </p>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default TextPreviewSection;
