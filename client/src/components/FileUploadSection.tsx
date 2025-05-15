import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Upload, FileText, AlertCircle, BookOpen, FileIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { formatFileSize } from '@/lib/fileHelpers';
import { parseEpubFile, EpubParseResult } from '@/lib/epubParser';
import EpubPreviewSection from '@/components/EpubPreviewSection';

interface ProcessedResult {
  text: string;
  chapters: { title: string; text: string }[];
  charCount: number;
  fileMetadata?: {
    key: string;
    name: string;
    size: number;
    url: string;
    mimeType: string;
  } | null;
  wasChunked: boolean;
  patternMatchCounts?: Record<string, number>;
}

interface FileUploadSectionProps {
  onTextProcessed: (
    result: ProcessedResult | null,
    error?: string
  ) => void;
}

const FileUploadSection: React.FC<FileUploadSectionProps> = ({ onTextProcessed }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [epubData, setEpubData] = useState<EpubParseResult | null>(null);
  const [isEpubPreviewMode, setIsEpubPreviewMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  
  // Reset all states
  const resetState = () => {
    setSelectedFile(null);
    setError(null);
    setEpubData(null);
    setIsEpubPreviewMode(false);
  };

  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  // Validate file type - accept txt, epub, and pdf files
  const validateFile = (file: File): boolean => {
    const validTypes = [
      '.txt', 'text/plain',
      '.epub', 'application/epub+zip',
      '.pdf', 'application/pdf'
    ];
    const fileType = file.type || file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validTypes.some(type => fileType.includes(type))) {
      setError("Invalid file type. Please upload a TXT, EPUB, or PDF file.");
      toast({
        title: "Invalid file type",
        description: "Please upload a TXT, EPUB, or PDF file.",
        variant: "destructive",
      });
      return false;
    }
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large. Maximum file size is ${formatFileSize(MAX_FILE_SIZE)}.`);
      toast({
        title: "File too large",
        description: `Maximum file size is ${formatFileSize(MAX_FILE_SIZE)}.`,
        variant: "destructive",
      });
      return false;
    }
    
    return true;
  };

  // Process EPUB files client-side
  const processEpubFile = async (file: File) => {
    try {
      setIsProcessing(true);
      
      // Parse the EPUB file
      const result = await parseEpubFile(file);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to parse EPUB file');
      }
      
      // Set EPUB data for preview
      setEpubData(result);
      setIsEpubPreviewMode(true);
      
      toast({
        title: "EPUB File Loaded",
        description: `${file.name} has been parsed and ${result.chapters.length} chapters were detected.`,
      });
      
      // Return success
      return true;
    } catch (error) {
      console.error('Error processing EPUB file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process EPUB file';
      
      setError(errorMessage);
      toast({
        title: "EPUB Processing Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      return false;
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Handle processed EPUB content
  const handleEpubContent = (content: string, title?: string) => {
    if (!content) return;
    
    // Create the processed result object
    const chaptersArray = content
      .split(/\n## /)
      .filter(Boolean)
      .map(section => {
        const lines = section.split('\n');
        const title = lines[0] || 'Untitled Chapter';
        const text = lines.slice(1).join('\n');
        return { title, text };
      });
    
    const result: ProcessedResult = {
      text: content,
      chapters: chaptersArray,
      charCount: content.length,
      wasChunked: chaptersArray.length > 1,
      fileMetadata: null
    };
    
    // Pass to parent component
    onTextProcessed(result);
    
    // Hide EPUB preview
    setIsEpubPreviewMode(false);
    
    // Show success toast
    toast({
      title: title ? `Chapter Selected: ${title}` : "Content Processed",
      description: `${chaptersArray.length} sections identified in the EPUB content.`,
    });
  };
  
  const processFile = useCallback(async (file: File) => {
    // Reset previous states
    resetState();
    
    // Validate file before processing
    if (!validateFile(file)) {
      return;
    }
    
    // Set the selected file for UI display
    setSelectedFile(file);
    
    // Process EPUB files client-side
    if (file.type === 'application/epub+zip') {
      await processEpubFile(file);
      return;
    }
    
    // For other file types, send to server
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Use the API endpoint
      const response = await fetch('/api/upload-ebook', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process file');
      }
      
      const data = await response.json();
      
      // Ensure data has the wasChunked property or set default based on chapter count
      if (typeof data.wasChunked !== 'boolean') {
        data.wasChunked = data.chapters && data.chapters.length > 1;
      }
      
      onTextProcessed(data);
      
      // Use the wasChunked property from the API response
      const chaptersDetected = data.wasChunked;
      
      if (chaptersDetected) {
        toast({
          title: "File Successfully Chunked",
          description: `${file.name} has been processed and divided into ${data.chapters?.length || 0} chapters.`,
        });
      } else {
        toast({
          title: "File Processed",
          description: `${file.name} has been processed, but no chapters could be detected automatically.`,
          variant: "default"
        });
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to process file';
      setError(errorMessage);
      onTextProcessed(null, errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [toast, onTextProcessed]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [processFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
    
    // Reset file input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFile]);

  const openFileSelector = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div>
      <Card>
        <CardContent className="p-6">
          <CardTitle className="font-bold text-xl text-gray-800 mb-4 flex items-center">
            <Upload className="h-5 w-5 text-primary mr-2" />
            Upload File
          </CardTitle>
          
          {/* Error alert */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {/* Selected file display */}
          {selectedFile && !error && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
              <div className="flex items-start">
                <div className={`p-2 rounded-md flex-shrink-0 mr-3 ${
                  selectedFile.name.toLowerCase().endsWith('.epub')
                    ? 'bg-blue-50'
                    : selectedFile.name.toLowerCase().endsWith('.pdf')
                      ? 'bg-red-50'
                      : 'bg-green-50'
                }`}>
                  {selectedFile.name.toLowerCase().endsWith('.epub') ? (
                    <BookOpen className="h-8 w-8 text-blue-500" />
                  ) : selectedFile.name.toLowerCase().endsWith('.pdf') ? (
                    <FileIcon className="h-8 w-8 text-red-500" />
                  ) : (
                    <FileText className="h-8 w-8 text-green-500" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-800">{selectedFile.name}</h3>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {formatFileSize(selectedFile.size)}
                    </Badge>
                    <Badge variant="outline" className={`text-xs ${
                      selectedFile.name.toLowerCase().endsWith('.pdf') 
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : selectedFile.name.toLowerCase().endsWith('.epub')
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-green-50 text-green-700 border-green-200'
                    }`}>
                      {selectedFile.name.split('.').pop()?.toUpperCase() || 'TXT'}
                    </Badge>
                  </div>
                  {isProcessing ? (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                        <div className="bg-primary h-1.5 rounded-full animate-pulse" style={{ width: '70%' }}></div>
                      </div>
                      <p className="text-xs text-primary mt-1">
                        <span className="font-medium">Processing file...</span> {
                          selectedFile.name.toLowerCase().endsWith('.epub')
                            ? 'Parsing EPUB structure and extracting content'
                            : 'Detecting chapters and analyzing text'
                        }
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-green-600 mt-2">
                      <span className="font-medium">Processing complete!</span> {
                        isEpubPreviewMode 
                          ? 'EPUB file parsed successfully' 
                          : 'Text has been chunked into chapters'
                      }
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Only show the drop zone if we're not in EPUB preview mode */}
          {!isEpubPreviewMode && (
            <div 
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-300 ${
                selectedFile && !error ? 'mb-0' : 'mb-4'
              } ${
                dragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-gray-200 hover:border-primary hover:bg-gray-50'
              }`}
              onClick={openFileSelector}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
            >
              <div className="flex justify-center space-x-2">
                <FileText className="h-8 w-8 text-gray-400" />
                <BookOpen className="h-8 w-8 text-blue-400" />
                <FileIcon className="h-8 w-8 text-red-400" />
              </div>
              <p className="mt-2 text-gray-600 font-medium">
                {selectedFile && !error
                  ? 'Upload a different file'
                  : 'Drag & drop your file here or click to browse'
                }
              </p>
              <p className="text-sm text-gray-500 mt-1">
                TXT files will be automatically chunked into chapters
              </p>
              <p className="text-sm text-gray-500 mt-1">
                EPUB files will be parsed client-side with chapter preview
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Supported formats: .txt, .epub, .pdf (Max 5MB)
              </p>
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept=".txt,.epub,.pdf" 
                onChange={handleFileChange}
                disabled={isProcessing}
              />
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* EPUB Preview Section */}
      {isEpubPreviewMode && epubData && (
        <EpubPreviewSection 
          epubData={epubData}
          onSelectChapter={(content, title) => handleEpubContent(content, title)}
          onUseAllContent={(content) => handleEpubContent(content)}
        />
      )}
    </div>
  );
};

export default FileUploadSection;
