import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Upload, FileType } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface FileUploadSectionProps {
  onTextProcessed: (
    result: { text: string; chapters: { title: string; text: string }[]; charCount: number } | null,
    error?: string
  ) => void;
}

const FileUploadSection: React.FC<FileUploadSectionProps> = ({ onTextProcessed }) => {
  const [dragActive, setDragActive] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const MAX_CHARS = 50000;

  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const processFile = useCallback(async (file: File) => {
    // Check file type
    const validTypes = ['.txt', '.epub', '.pdf', 'text/plain', 'application/epub+zip', 'application/pdf'];
    const fileType = file.type || file.name.substring(file.name.lastIndexOf('.'));
    
    if (!validTypes.some(type => fileType.includes(type))) {
      toast({
        title: "Invalid file type",
        description: "Please upload a TXT, EPUB, or PDF file.",
        variant: "destructive",
      });
      return;
    }
    
    // Check file size
    if (file.size > 5 * 1024 * 1024) { // 5MB
      toast({
        title: "File too large",
        description: "Maximum file size is 5MB.",
        variant: "destructive",
      });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process file');
      }
      
      const data = await response.json();
      setTextContent(data.text);
      setCharCount(data.text.length);
      onTextProcessed(data);
      
      toast({
        title: "File processed",
        description: `${file.name} has been successfully processed.`,
      });
    } catch (err: any) {
      onTextProcessed(null, err.message || 'Failed to process file');
      toast({
        title: "Error",
        description: err.message || 'Failed to process file',
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
  }, [processFile]);

  const handleTextChange = useCallback(async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    
    // Enforce character limit
    if (text.length <= MAX_CHARS) {
      setTextContent(text);
      setCharCount(text.length);
      
      if (text.trim().length > 0) {
        try {
          const response = await fetch('/api/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error);
          }
          
          const data = await response.json();
          onTextProcessed(data);
        } catch (err: any) {
          onTextProcessed(null, err.message);
        }
      } else {
        onTextProcessed({ text: '', chapters: [], charCount: 0 });
      }
    }
  }, [onTextProcessed]);

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
          Upload Your Text
        </CardTitle>
        
        <div 
          className={`border-2 border-dashed rounded-lg p-8 mb-4 text-center cursor-pointer transition-all duration-300 ${
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
          <FileType className="h-10 w-10 mx-auto text-gray-400" />
          <p className="mt-2 text-gray-600">Drag & drop your file here or click to browse</p>
          <p className="text-xs text-gray-400 mt-1">Supported formats: .txt, .epub, .pdf (Max 5MB)</p>
          <input 
            type="file" 
            ref={fileInputRef}
            className="hidden" 
            accept=".txt,.epub,.pdf" 
            onChange={handleFileChange}
            disabled={isProcessing}
          />
        </div>
        
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-medium text-gray-700">Or paste text directly:</h3>
          <span className={`text-xs ${charCount > MAX_CHARS ? 'text-red-500' : 'text-gray-400'}`}>
            {charCount}/{MAX_CHARS} characters
          </span>
        </div>
        
        <Textarea 
          className="h-32 font-serif"
          placeholder="Paste your text here..."
          value={textContent}
          onChange={handleTextChange}
          disabled={isProcessing}
        />
      </CardContent>
    </Card>
  );
};

export default FileUploadSection;
