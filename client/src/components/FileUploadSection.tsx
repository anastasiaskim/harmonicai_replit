import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { formatFileSize } from '@/lib/fileHelpers';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  
  // Reset all states
  const resetState = () => {
    setSelectedFile(null);
    setError(null);
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

  const processFile = useCallback(async (file: File) => {
    // Reset previous states
    resetState();
    
    // Validate file before processing
    if (!validateFile(file)) {
      return;
    }
    
    // Set the selected file for UI display
    setSelectedFile(file);
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Use the new edge function endpoint
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
    <Card>
      <CardContent className="p-6">
        <CardTitle className="font-bold text-xl text-gray-800 mb-4 flex items-center">
          <Upload className="h-5 w-5 text-primary mr-2" />
          Upload Your Text File
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
              <FileText className="h-10 w-10 text-primary mr-3 flex-shrink-0" />
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
                      <span className="font-medium">Processing file...</span> Detecting chapters and analyzing text
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-green-600 mt-2">
                    <span className="font-medium">Processing complete!</span> Text has been chunked into chapters
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* File upload drop zone */}
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
          <FileText className="h-10 w-10 mx-auto text-gray-400" />
          <p className="mt-2 text-gray-600 font-medium">
            {selectedFile && !error
              ? 'Upload a different file'
              : 'Drag & drop your text file here or click to browse'
            }
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Your file will be automatically chunked into chapters
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
      </CardContent>
    </Card>
  );
};

export default FileUploadSection;
